#!/bin/sh
set -e

cd /var/www/html

if [ -z "$APP_KEY" ]; then
  echo "WARNING: APP_KEY is not set"
fi

# Ensure runtime dirs exist and are writable
mkdir -p storage/framework/{cache,sessions,views} storage/logs bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache || true

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  php artisan migrate --force
fi

php-fpm -D
exec nginx -g 'daemon off;'
