#!/usr/bin/env bash
# Uses the existing checkout; prepare dependencies and assets before disconnecting.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
: "${DATABASE_URL:?Configure the office PostgreSQL connection securely}"
: "${SAAS_OWNER_MFA_KEY:?Restore the existing office MFA encryption key securely}"
: "${ELHAFEZ_WRITE_AUTHORITY_ID:?Configure the enrolled office server identity}"
: "${ELHAFEZ_FILE_STORAGE_ROOT:?Configure durable local attachment storage}"
test -f apps/web/dist/index.html
api_port="${ELHAFEZ_API_PORT:-3300}"
web_port="${ELHAFEZ_WEB_PORT:-4188}"
api_pid=''
proxy_pid=''
tls_pid=''
cleanup(){ if [[ -n "$tls_pid" ]]; then kill "$tls_pid" 2>/dev/null; fi; if [[ -n "$api_pid" ]]; then kill "$api_pid" 2>/dev/null; fi; if [[ -n "$proxy_pid" ]]; then kill "$proxy_pid" 2>/dev/null; fi; }
trap cleanup EXIT INT TERM
PORT="$api_port" ELHAFEZ_BIND_HOST=127.0.0.1 node --import ./apps/api/scripts/typescript-runtime.mjs apps/api/src/main.ts &
api_pid=$!
ready=false
for attempt in {1..60}; do
 if curl --silent --fail --connect-timeout 1 --max-time 2 "http://127.0.0.1:${api_port}/health" >/dev/null; then ready=true; break; fi
 if ! kill -0 "$api_pid" 2>/dev/null; then wait "$api_pid"; exit 1; fi
 sleep 1
done
[[ "$ready" == true ]]
PORT="$web_port" ELHAFEZ_WEB_BIND_HOST="${ELHAFEZ_WEB_BIND_HOST:-127.0.0.1}" ELHAFEZ_API_BASE_URL="http://127.0.0.1:${api_port}" node deploy/railway/static-proxy.mjs &
proxy_pid=$!
if [[ -n "${ELHAFEZ_TLS_CERT:-}" || -n "${ELHAFEZ_TLS_KEY:-}" ]]; then
 : "${ELHAFEZ_TLS_CERT:?Configure LAN certificate path}"
 : "${ELHAFEZ_TLS_KEY:?Configure LAN private key path}"
 ELHAFEZ_TLS_UPSTREAM="http://127.0.0.1:${web_port}" node deploy/local/tls-proxy.mjs &
 tls_pid=$!
 wait -n "$api_pid" "$proxy_pid" "$tls_pid"
else
 wait -n "$api_pid" "$proxy_pid"
fi
