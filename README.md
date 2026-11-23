# Loadplanner

Monorepo boilerplate: **Laravel 13 API** + **Angular 22 SPA**, local MySQL via Docker Compose, ARM64 Docker image for **ECR → m6g EC2**, dedicated MySQL in staging/production.

```text
apps/api   Laravel JSON API (:8000 locally)
apps/web   Angular SPA (:4200 locally, proxies /api)
docker/    nginx + php-fpm runtime config
deploy/    ECR push + EC2 run helpers
```

## Prerequisites

- PHP 8.3+, Composer
- Node 22+ (Node 24 works), npm
- Docker (Compose + Buildx)
- AWS CLI (for ECR/EC2 deploy)

## Formatting & linting

| App | Tools | Commands |
| --- | --- | --- |
| `apps/web` | Prettier, ESLint (`angular-eslint`) | `npm run format` / `npm run lint` |
| `apps/api` | Pint, Rector | `composer format` / `composer rector` |

Install the git pre-commit hook (formats staged web files with Prettier and staged PHP with Pint):

```bash
make hooks-install
```

## Get started

Open [`get-started.html`](get-started.html) in a browser for a step-by-step local setup guide (prerequisites, MySQL, API, web, verify, daily commands).

## Local development

### 1. Start MySQL

```bash
cp .env.example .env
make up
```

MySQL listens on `localhost:3307` (`loadplanner` / `secret`) to avoid clashing with a host MySQL on `3306`.

### 2. API

```bash
cp apps/api/.env.example apps/api/.env
# DB_HOST=127.0.0.1 is correct when MySQL is published from Compose
cd apps/api && composer install && php artisan key:generate
make migrate
make serve-api
```

Health check: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

### 3. Web

```bash
cd apps/web && npm install
make serve-web
```

Open [http://localhost:4200](http://localhost:4200) — `/api` is proxied to Laravel.

### Truckit component library (optional)

Library lives in AWS CodeArtifact (`Angular ^22.1`):

```bash
aws codeartifact login --tool npm \
  --domain truckit --domain-owner 349139559071 \
  --repository component-library --region ap-southeast-2

cd apps/web && npm install truckit-component-library
```

Then prepend tokens in `apps/web/angular.json` `styles`:

```json
"styles": [
  "node_modules/truckit-component-library/styles/tokens.css",
  "src/styles.scss"
]
```

Storybook: [https://component.truckitmetro.com/storybook](https://component.truckitmetro.com/storybook)

## Production image (ARM64 / Graviton)

Single container: **nginx** serves the Angular SPA and proxies `/api` to **php-fpm** (Laravel).

```bash
# Local ARM64 build (Apple Silicon / buildx)
make build-arm

# Create ECR repo (once), build, and push
export AWS_REGION=ap-southeast-2
export AWS_ACCOUNT_ID=123456789012
make push-ecr
```

### EC2 (minimal m6g)

1. Launch **m6g** (AL2023), attach an instance role that can pull from ECR.
2. Security group: inbound `80` (and `443` if you terminate TLS later); outbound to your MySQL host.
3. Copy env template and fill dedicated MySQL + `APP_KEY`:

```bash
sudo cp deploy/loadplanner.env.example /etc/loadplanner.env
sudo nano /etc/loadplanner.env
```

4. Run:

```bash
export AWS_REGION=ap-southeast-2 AWS_ACCOUNT_ID=...
./deploy/ec2/docker-run.sh
```

Optional first-boot helper: [`deploy/ec2/user-data.sh`](deploy/ec2/user-data.sh).

Set `RUN_MIGRATIONS=true` in the env file for migrate-on-start, or run migrations out-of-band.

## Environment contract

| Variable | Local | Staging / production |
| --- | --- | --- |
| `DB_HOST` | `127.0.0.1` (Compose-published) or `mysql` (in-network) | Dedicated MySQL hostname |
| `APP_URL` / `FRONTEND_URL` | `localhost:8000` / `:4200` | EC2 / domain URL |
| `APP_KEY` | `php artisan key:generate` | Same key across deploys |

## CI

Automatic ECR builds are paused until GitHub Actions is ready. [`.github/workflows/ecr-build.yml`](.github/workflows/ecr-build.yml) is still in the repo and can be started manually with **Run workflow**. A manual run still needs the `AWS_ROLE_TO_ASSUME` secret, plus optional variables `AWS_REGION` and `ECR_REPOSITORY`, before it can push the `linux/arm64` image. Pushes to `master` do not start this workflow.
