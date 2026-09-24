#!/bin/sh
# Entrypoint script for backend container
# Runs as root to fix volume permissions, then drops to appuser

# Ensure data directory exists and set proper ownership
mkdir -p /app/data
chown -R appuser:appgroup /app/data

# 若挂载了 Docker socket，则授予 appuser 访问权限（镜像/容器/卷/网络管理所需）
if [ -S /var/run/docker.sock ]; then
  DOCKER_GID=$(stat -c '%g' /var/run/docker.sock 2>/dev/null || echo "")
  if [ -n "$DOCKER_GID" ]; then
    DOCKER_GROUP_NAME=$(getent group "$DOCKER_GID" | cut -d: -f1)
    if [ -z "$DOCKER_GROUP_NAME" ]; then
      groupadd -g "$DOCKER_GID" dockersock 2>/dev/null || true
      DOCKER_GROUP_NAME=dockersock
    fi
    usermod -aG "$DOCKER_GROUP_NAME" appuser 2>/dev/null || true
  fi
fi

# Drop privileges and run the application
exec gosu appuser "$@"