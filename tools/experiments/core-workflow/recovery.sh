#!/usr/bin/env bash
# Only the task-owned disposable container and named test databases are accepted.
set -euo pipefail
umask 077
cd "$(dirname "${BASH_SOURCE[0]}")/../../.."
test -f /tmp/core-recovery-manifest.json
docker exec elhafez-core-test pg_dump -U postgres -Fc elhafez_core_test > /tmp/elhafez-core-recovery.dump
docker exec -i elhafez-core-test pg_restore --list < /tmp/elhafez-core-recovery.dump > /tmp/elhafez-core-recovery.list
test -s /tmp/elhafez-core-recovery.list
docker exec elhafez-core-test dropdb -U postgres --if-exists elhafez_core_restore
docker exec elhafez-core-test createdb -U postgres elhafez_core_restore
docker exec -i elhafez-core-test pg_restore -U postgres --exit-on-error -d elhafez_core_restore < /tmp/elhafez-core-recovery.dump
query="SELECT 'billing',count(*)::text,coalesce(sum(outstanding),0)::text FROM billing_invoices WHERE status='POSTED'; SELECT 'commission',count(*)::text,coalesce(sum(amount),0)::text FROM ecr_commission_claims WHERE status='APPROVED'; SELECT state,count(*)::text FROM oc_commands GROUP BY state ORDER BY state; SELECT id,checksum FROM pc_files ORDER BY id; SELECT company_id,authority_id FROM oc_write_authorities ORDER BY company_id;"
docker exec elhafez-core-test psql -U postgres -d elhafez_core_test -At -c "$query" > /tmp/elhafez-core-before.txt
docker exec elhafez-core-test psql -U postgres -d elhafez_core_restore -At -c "$query" > /tmp/elhafez-core-after.txt
cmp /tmp/elhafez-core-before.txt /tmp/elhafez-core-after.txt
node --input-type=module <<'JS'
import { readFile, mkdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const manifest=JSON.parse(await readFile('/tmp/core-recovery-manifest.json','utf8'));
const target='/tmp/elhafez-core-restored-files';await mkdir(target,{recursive:true});
for(const file of manifest.files){
 if(!/^[0-9a-f-]{36}$/.test(file.storageKey))throw Error('Invalid server file key');
 const source=join(manifest.filesRoot,file.storageKey),destination=join(target,file.storageKey);
 const original=await readFile(source);if(createHash('sha256').update(original).digest('hex')!==file.checksum)throw Error('Source attachment checksum mismatch');
 await copyFile(source,destination);
 if(createHash('sha256').update(await readFile(destination)).digest('hex')!==file.checksum)throw Error('Restored attachment checksum mismatch');
}
console.log('PASS: clean PostgreSQL restore, exact invoice/commission totals, pending/accepted/review commands, write authority, attachment links and SHA-256 bytes. No owner operation replayed.');
JS
