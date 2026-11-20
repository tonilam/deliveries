# 2026-11-20 — Laravel + Angular monorepo boilerplate

- Scaffolded Laravel 13 API (`apps/api`) and Angular 22 SPA (`apps/web`).
- Local MySQL via Docker Compose; staging/prod use dedicated external MySQL.
- ARM64 multi-stage Docker image (nginx + php-fpm) for ECR → m6g EC2.
