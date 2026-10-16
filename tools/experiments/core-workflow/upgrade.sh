#!/usr/bin/env bash
# Upgrade only a disposable baseline database containing an existing booking.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../../.."
upgrade_root="$(mktemp -d /tmp/elhafez-core-upgrade.XXXXXX)"
node --input-type=module - "$upgrade_root" <<'JS'
import { cp, readdir } from 'node:fs/promises';
import { join } from 'node:path';
const root=process.argv[2];await cp('prisma/schema.prisma',join(root,'schema.prisma'));await cp('prisma/migrations',join(root,'migrations'),{recursive:true,filter:source=>!source.includes('20261016010000_core_workflow')&&!source.includes('20261016020000_offline_review')&&!source.includes('20261016030000_booking_capacity_hold')&&!source.includes('20261016040000_offline_document_numbers')&&!source.includes('20261016050000_booking_individual_invoices')&&!source.includes('20261016060000_resumable_file_uploads')});
if(!(await readdir(join(root,'migrations'))).length)throw Error('Baseline migration copy is empty');
JS
docker exec elhafez-core-test dropdb -U postgres --if-exists elhafez_core_upgrade
docker exec elhafez-core-test createdb -U postgres elhafez_core_upgrade
export DATABASE_URL=postgresql://postgres:core-test-only@127.0.0.1:55432/elhafez_core_upgrade
npx --yes pnpm@9.15.0 exec prisma migrate deploy --schema "$upgrade_root/schema.prisma" > /tmp/elhafez-core-upgrade-baseline.log
docker exec -i elhafez-core-test psql -U postgres -d elhafez_core_upgrade -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO hub_bookings(id,company_id,branch_id,code,program_id,customer_id,customer_party_id,traveler_ids,status,financial_state,allocation_ids,created_at,updated_at)
VALUES('legacy-upgrade-booking','upgrade-company','upgrade-branch','UPGRADE-1','upgrade-program','upgrade-customer','upgrade-party','["upgrade-traveler"]','PRELIMINARY','UNCONFIRMED','[]',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
SQL
cp -R prisma/migrations/20261016010000_core_workflow prisma/migrations/20261016020000_offline_review prisma/migrations/20261016030000_booking_capacity_hold prisma/migrations/20261016040000_offline_document_numbers prisma/migrations/20261016050000_booking_individual_invoices prisma/migrations/20261016060000_resumable_file_uploads "$upgrade_root/migrations/"
npx --yes pnpm@9.15.0 exec prisma migrate deploy --schema "$upgrade_root/schema.prisma" > /tmp/elhafez-core-upgrade-new.log
docker exec -i elhafez-core-test psql -U postgres -d elhafez_core_upgrade -v ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM hub_bookings WHERE id='legacy-upgrade-booking' AND customer_party_id='upgrade-party' AND traveler_ids='["upgrade-traveler"]'::jsonb AND financial_customer_id IS NULL AND financial_party_id IS NULL AND create_request_id IS NULL AND commission_agreement IS NULL AND revision=0) THEN RAISE EXCEPTION 'Existing booking identity/history changed during upgrade'; END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='oc_commands') THEN RAISE EXCEPTION 'Coordination table missing'; END IF;
END $$;
SQL
printf '%s\n' 'PASS: accepted baseline migrations -> existing booking -> additive core migration; identity and legacy debtor fallback preserved.'
