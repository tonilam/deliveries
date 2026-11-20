#!/usr/bin/env bash
# Pull the ARM64 image from ECR and run the single-container app on m6g EC2.
set -euo pipefail

: "${AWS_REGION:?Set AWS_REGION}"
: "${AWS_ACCOUNT_ID:?Set AWS_ACCOUNT_ID}"
: "${ECR_REPOSITORY:=loadplanner}"
: "${IMAGE_TAG:=latest}"
: "${ENV_FILE:=/etc/loadplanner.env}"
: "${CONTAINER_NAME:=loadplanner}"
: "${HOST_PORT:=80}"

IMAGE="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${IMAGE_TAG}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing env file: ${ENV_FILE}" >&2
  echo "Copy deploy/loadplanner.env.example to ${ENV_FILE} and fill values." >&2
  exit 1
fi

aws ecr get-login-password --region "${AWS_REGION}" \
  | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

docker pull "${IMAGE}"

if docker ps -a --format '{{.Names}}' | grep -qx "${CONTAINER_NAME}"; then
  docker rm -f "${CONTAINER_NAME}"
fi

docker run -d \
  --name "${CONTAINER_NAME}" \
  --restart unless-stopped \
  -p "${HOST_PORT}:80" \
  --env-file "${ENV_FILE}" \
  "${IMAGE}"

echo "Running ${CONTAINER_NAME} from ${IMAGE} on :${HOST_PORT}"
