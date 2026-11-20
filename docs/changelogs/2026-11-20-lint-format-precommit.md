# 2026-11-20 — Lint/format tooling + pre-commit

- Web: ESLint via `angular-eslint@22` (Prettier already present); format/lint npm scripts; `eslint-config-prettier`.
- API: Rector + `driftingly/rector-laravel` (Pint already present); `rector.php`, `pint.json`, composer format/lint/rector scripts.
- Git pre-commit hook in `.githooks/pre-commit` runs Prettier + Pint on staged files; install with `make hooks-install`.
