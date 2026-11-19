#!/usr/bin/env sh
set -eu

ACTION="${1:-up}"

case "$ACTION" in
  up)
    docker compose pull --ignore-buildable
    docker compose up -d --build --remove-orphans
    docker compose ps
    ;;
  down)
    docker compose down
    ;;
  restart)
    docker compose up -d --build --force-recreate --remove-orphans
    docker compose ps
    ;;
  logs)
    docker compose logs -f --tail=200 forum
    ;;
  status)
    docker compose ps
    ;;
  *)
    echo "Usage: sh scripts/deploy.sh [up|down|restart|logs|status]" >&2
    exit 2
    ;;
esac
