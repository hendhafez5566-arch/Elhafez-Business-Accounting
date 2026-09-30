# Functional Closure Backup / Restore Verification

## Safety boundary

Restore is permitted only through `platform-operations`, with maintenance mode active and a provider that reports `restoreReady`. A verified checksum and matching company scope are mandatory. Never test restore against production.

## Drill

1. Select a disposable recovery database and confirm it contains no production endpoint.
2. Record current migration head, health/readiness response, company/branch counts and exact financial control totals.
3. Create and verify a backup; retain provider reference, checksum, manifest and job ID.
4. Enter maintenance mode, restore through Owner Control, and wait for the durable restore job.
5. The service automatically runs post-restore database, Prisma migration and provider-health checks before completing or revoking sessions.
6. Run `pnpm prisma:generate`, `pnpm architecture:check`, focused owner smoke tests, AC-14 reconciliation verification and tenant/branch authorization probes.
7. Compare counts and exact-decimal totals with step 2; attach unresolved exceptions.
8. Exit maintenance only when every check passes. Otherwise retain maintenance, diagnose, and restore the last verified backup.

Evidence: backup/restore IDs, checksum, timestamps, operator, migration head, smoke results, reconciliation report and recovery time.
