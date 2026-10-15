#!/usr/bin/env bash
# Disposable native PostgreSQL only. Never accepts an external DATABASE_URL.
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$repository_root"
container_name="elhafez-followup-test-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}-$$"
cleanup() {
  status=$?
  trap - EXIT
  if (( status != 0 )); then
    docker logs "$container_name"
  fi
  docker rm --force "$container_name" > /dev/null
  exit "$status"
}

docker run --detach --name "$container_name" \
  --publish 127.0.0.1::5432 \
  --env POSTGRES_PASSWORD=followup-test-only \
  --env POSTGRES_DB=elhafez_followup_test \
  postgres:16.6-alpine
trap cleanup EXIT

ready=false
for attempt in {1..30}; do
  if docker exec "$container_name" pg_isready --host 127.0.0.1 --username postgres --dbname elhafez_followup_test; then
    ready=true
    break
  fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  printf '%s\n' 'Disposable PostgreSQL failed to become ready.' >&2
  exit 1
fi

port_binding="$(docker port "$container_name" 5432/tcp)"
postgres_port="${port_binding##*:}"
if [[ ! "$postgres_port" =~ ^[0-9]+$ ]]; then
  printf '%s\n' 'Could not resolve disposable PostgreSQL loopback port.' >&2
  exit 1
fi
export FOLLOWUP_TEST_DATABASE_URL="postgresql://postgres:followup-test-only@127.0.0.1:${postgres_port}/elhafez_followup_test"
export DATABASE_URL="$FOLLOWUP_TEST_DATABASE_URL"

pnpm exec prisma migrate deploy --schema prisma/schema.prisma
pnpm exec prisma migrate status --schema prisma/schema.prisma
TSX_TSCONFIG_PATH=modules/crm-followups/tsconfig.json \
  node --import tsx modules/crm-followups/src/infrastructure/schedule-postgres.integration.ts
