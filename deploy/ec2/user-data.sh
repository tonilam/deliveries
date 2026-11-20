#!/bin/bash
# Minimal Amazon Linux 2023 user-data for m6g: install Docker + AWS CLI helpers.
set -euxo pipefail

dnf update -y
dnf install -y docker awscli
systemctl enable --now docker
usermod -aG docker ec2-user || true

mkdir -p /opt/loadplanner
cat >/opt/loadplanner/docker-run.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
# Populate these via SSM/instance tags or replace after launch.
: "${AWS_REGION:=ap-southeast-2}"
: "${AWS_ACCOUNT_ID:?Set AWS_ACCOUNT_ID}"
: "${ECR_REPOSITORY:=loadplanner}"
: "${IMAGE_TAG:=latest}"
ENV_FILE=/etc/loadplanner.env
IMAGE="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${IMAGE_TAG}"
aws ecr get-login-password --region "${AWS_REGION}" \
  | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
docker pull "${IMAGE}"
docker rm -f loadplanner 2>/dev/null || true
docker run -d --name loadplanner --restart unless-stopped -p 80:80 --env-file "${ENV_FILE}" "${IMAGE}"
EOF
chmod +x /opt/loadplanner/docker-run.sh

echo "Place /etc/loadplanner.env then run: AWS_ACCOUNT_ID=... /opt/loadplanner/docker-run.sh"
