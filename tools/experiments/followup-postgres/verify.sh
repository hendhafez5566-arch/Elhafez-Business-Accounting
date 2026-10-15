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

# Prove normalization preserves a stored UUID identity and an existing link.
docker exec "$container_name" createdb --username postgres elhafez_file_key_test
cat tools/experiments/followup-postgres/file-key-before.sql \
  prisma/migrations/20260929003000_platform_file_key_text/migration.sql \
  tools/experiments/followup-postgres/file-key-after.sql \
  prisma/migrations/20260929003000_platform_file_key_text/migration.sql \
  tools/experiments/followup-postgres/file-key-final.sql \
  | docker exec --interactive "$container_name" psql --username postgres --dbname elhafez_file_key_test --set ON_ERROR_STOP=1

pnpm exec prisma migrate deploy --schema prisma/schema.prisma
pnpm exec prisma migrate status --schema prisma/schema.prisma
TSX_TSCONFIG_PATH=modules/crm-followups/tsconfig.json \
  node --import tsx modules/crm-followups/src/infrastructure/schedule-postgres.integration.ts
node --import ./apps/api/scripts/typescript-test-runtime.mjs apps/api/src/followup-http.integration.ts
TSX_TSCONFIG_PATH=modules/agent-management/tsconfig.json \
  node --import tsx modules/agent-management/src/infrastructure/agent-hierarchy-postgres.integration.ts
