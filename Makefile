.PHONY: help up down mysql-logs api-install web-install hooks-install migrate serve-api serve-web build-arm push-ecr

AWS_REGION ?= ap-southeast-2
AWS_ACCOUNT_ID ?=
ECR_REPOSITORY ?= loadplanner
IMAGE_TAG ?= latest

help:
	@echo "Loadplanner targets:"
	@echo "  make up            Start local MySQL on localhost:3307 (Docker Compose)"
	@echo "  make down          Stop Compose services"
	@echo "  make api-install   Composer install in apps/api"
	@echo "  make web-install   npm install in apps/web"
	@echo "  make hooks-install Install git pre-commit hook (Prettier + Pint)"
	@echo "  make migrate       Run Laravel migrations (host → local MySQL)"
	@echo "  make serve-api     php artisan serve on :8000"
	@echo "  make serve-web     ng serve on :4200 (proxies /api)"
	@echo "  make build-arm     Build linux/arm64 image locally (no push)"
	@echo "  make push-ecr      Build + push ARM64 image to ECR"

up:
	docker compose up -d mysql

down:
	docker compose down

mysql-logs:
	docker compose logs -f mysql

api-install:
	cd apps/api && composer install

web-install:
	cd apps/web && npm install

hooks-install:
	mkdir -p .git/hooks
	cp .githooks/pre-commit .git/hooks/pre-commit
	chmod +x .git/hooks/pre-commit .githooks/pre-commit
	@echo "Installed pre-commit hook (Prettier + Pint on staged files)."

migrate:
	cd apps/api && php artisan migrate

serve-api:
	cd apps/api && php artisan serve --host=127.0.0.1 --port=8000

serve-web:
	cd apps/web && npm start

build-arm:
	docker buildx build --platform linux/arm64 -t $(ECR_REPOSITORY):$(IMAGE_TAG) --load .

push-ecr:
	AWS_REGION=$(AWS_REGION) AWS_ACCOUNT_ID=$(AWS_ACCOUNT_ID) ECR_REPOSITORY=$(ECR_REPOSITORY) IMAGE_TAG=$(IMAGE_TAG) ./deploy/ecr-push.sh
