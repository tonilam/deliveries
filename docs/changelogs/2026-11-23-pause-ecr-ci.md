# 2026-11-23 — Pause automatic ECR builds

- Removed the push trigger from `.github/workflows/ecr-build.yml` so merges no longer start a failing AWS credential job.
- Left manual **Run workflow** in place. README notes that automatic builds are paused.
