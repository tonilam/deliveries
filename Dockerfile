# syntax=docker/dockerfile:1.7
# Multi-stage image for m6g (ARM64) EC2: nginx + php-fpm + Angular SPA + Laravel API

ARG PHP_VERSION=8.3
ARG NODE_VERSION=22

# -----------------------------------------------------------------------------
# Stage: Angular SPA build
# -----------------------------------------------------------------------------
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-bookworm-slim AS web-build
WORKDIR /app/web
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci
COPY apps/web/ ./
RUN npm run build

# -----------------------------------------------------------------------------
# Stage: Composer (Laravel) deps
# -----------------------------------------------------------------------------
FROM --platform=$TARGETPLATFORM composer:2 AS api-vendor
WORKDIR /app
COPY apps/api/composer.json apps/api/composer.lock ./
RUN composer install \
    --no-dev \
    --no-interaction \
    --no-scripts \
    --prefer-dist \
    --optimize-autoloader

# -----------------------------------------------------------------------------
# Stage: Runtime (nginx + php-fpm)
# -----------------------------------------------------------------------------
FROM --platform=$TARGETPLATFORM php:${PHP_VERSION}-fpm-bookworm AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
      nginx \
      curl \
      libpng-dev \
      libjpeg62-turbo-dev \
      libfreetype6-dev \
      libzip-dev \
      libicu-dev \
      libonig-dev \
      unzip \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
      pdo_mysql \
      mbstring \
      zip \
      intl \
      gd \
      bcmath \
      opcache \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default

WORKDIR /var/www/html

COPY --from=api-vendor /app/vendor ./vendor
COPY apps/api/ ./
COPY --from=web-build /app/web/dist/web/browser/ ./public/
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY docker/php/php.ini /usr/local/etc/php/conf.d/99-loadplanner.ini
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

# Laravel front controller must remain for /api PHP routing
# Angular build overwrote public/; restore index.php and .htaccess from API copy above
# (apps/api/public is copied with apps/api/; Angular files merge into public/)
COPY apps/api/public/index.php apps/api/public/.htaccess ./public/

RUN chmod +x /usr/local/bin/entrypoint.sh \
    && chown -R www-data:www-data storage bootstrap/cache \
    && php artisan package:discover --ansi || true

ENV APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr \
    RUN_MIGRATIONS=false

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1/up || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
