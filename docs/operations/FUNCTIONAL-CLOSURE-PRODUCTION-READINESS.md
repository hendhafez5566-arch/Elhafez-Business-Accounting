# Functional Closure Production Readiness Gates

No deployment is authorized by this document.

## Environment/config inventory

Required secrets/configuration: production `DATABASE_URL`; session/JWT secrets; public API/web origins; trusted proxy/TLS settings; file provider; backup provider/location/retention; restore target allowlist; maintenance marker; SMTP/message providers when enabled; logging/monitoring endpoints; `NODE_ENV=production`. Preview/demo credentials and bypass flags are forbidden. Production startup must fail closed when secrets, database, migrations, backup readiness or subscription controls are unavailable.

## Release gates

- [ ] Change Safety and Engineering Integrity.
- [ ] Prisma validate/generate and additive migration review/rehearsal.
- [ ] Full lint, typecheck, architecture and tests.
- [ ] Authorization and company/branch isolation suites.
- [ ] Exact 44-output owner/authorization suite.
- [ ] CRM, Procurement, Tourism/Hajj-Umrah and Treasury E2E suites.
- [ ] AC-14 counts/totals/scope/unresolved-exception reconciliation accepted.
- [ ] Verified backup plus successful disposable restore and post-restore checks.
- [ ] `/health` and readiness prove database, migration and required providers.
- [ ] Preview authentication disabled; unknown/demo credentials fail.

## Smoke/UAT

Authenticate a real tenant administrator and branch-limited operator; verify isolation; create/approve/convert a quotation; source/receive/invoice a purchase; confirm/fulfill/bill a booking; receive/pay and reconcile a bank line; run cheque and cash-count lifecycles; generate representative documents; inspect attachments/activity/audit; verify Arabic/RTL/mobile/keyboard behavior; sign off every parity-matrix family.

## Release and rollback

Record release SHA, migration IDs, config checksum, backup ID and approvers. Apply migrations once, start services, run readiness and smoke gates, then enable traffic. On failure stop traffic and enter maintenance. Roll application back only when schema-compatible; never reverse an accepted destructive financial event or edit a migration. Restore the verified backup only under the recovery runbook, rerun migration/reconciliation/post-restore checks, and record the incident and decision.
