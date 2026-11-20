#!/usr/bin/env bash
# Build linux/arm64 image and push to ECR (for m6g EC2).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

: "${AWS_REGION:?Set AWS_REGION}"
: "${AWS_ACCOUNT_ID:?Set AWS_ACCOUNT_ID}"
: "${ECR_REPOSITORY:=loadplanner}"
: "${IMAGE_TAG:=latest}"

REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
IMAGE="${REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG}"

aws ecr describe-repositories --repository-names "${ECR_REPOSITORY}" --region "${AWS_REGION}" >/dev/null 2>&1 \
  || aws ecr create-repository --repository-name "${ECR_REPOSITORY}" --region "${AWS_REGION}"

aws ecr get-login-password --region "${AWS_REGION}" \
  | docker login --username AWS --password-stdin "${REGISTRY}"

docker buildx create --name loadplanner-builder --use 2>/dev/null || docker buildx use loadplanner-builder

docker buildx build \
  --platform linux/arm64 \
  -t "${IMAGE}" \
  --push \
  .

echo "Pushed ${IMAGE}"
