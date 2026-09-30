# Functional Closure Legacy Migration and Reconciliation Rehearsal

This is a **non-production-only** wrapper around the accepted AC-14 coordinator. The frozen forensic files are specifications, not import payloads. A real legacy export must be supplied at execution time.

## Safe invocation

1. Provision an empty disposable PostgreSQL database and set `NODE_ENV=test` or `NODE_ENV=staging`. Never point `DATABASE_URL` at production.
2. Create a verified backup through `platform-operations` before loading a snapshot.
3. Run `pnpm --filter @elhafez/api ac14 -- preflight --snapshot <path>` and require zero ownership/scope/schema errors.
4. Run the staged import with the same immutable run ID. Re-running that ID must converge through owner idempotency keys.
5. Run `verify` and archive its JSON report beside the source checksum.

## Mandatory reconciliation report

The accepted report must contain, per owner and company/branch:

- source, accepted, rejected and target record counts;
- exact-decimal source and target totals by currency for GL debit/credit, AR, AP, advances and Treasury movements;
- scope violations, duplicate business keys, missing owner references and unmapped accounts;
- unresolved exceptions with source key, owner, reason and retry disposition;
- the 40 golden-scenario result set.

Acceptance requires equal accepted/target counts, balanced GL totals, equal owner/subledger totals, no cross-company/branch records and zero unresolved **financial** exceptions. Operational exceptions may be waived only with a named owner and retained report evidence.

## Retry and rollback

Imports call canonical owner boundaries and retain the migration journal; they never update owner tables directly. Correct source data and replay rejected rows with the same source identity. Do not delete accepted economic history. If the run cannot be accepted, discard the disposable target and restore its verified pre-run backup. Production execution is a separate approved operation.
