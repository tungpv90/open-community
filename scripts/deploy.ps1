param(
  [ValidateSet('up', 'down', 'restart', 'logs', 'status')]
  [string]$Action = 'up'
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker is not installed or is not available on PATH.'
}

switch ($Action) {
  'up' {
    docker compose pull --ignore-buildable
    docker compose up -d --build --remove-orphans
    docker compose ps
  }
  'down' { docker compose down }
  'restart' {
    docker compose up -d --build --force-recreate --remove-orphans
    docker compose ps
  }
  'logs' { docker compose logs -f --tail=200 forum }
  'status' { docker compose ps }
}
