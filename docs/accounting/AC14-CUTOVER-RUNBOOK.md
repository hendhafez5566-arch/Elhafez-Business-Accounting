# AC-14 Migration Cutover Readiness Runbook

This runbook establishes readiness only. It does **not** authorize or perform a production cutover.

## Prerequisites

- Target code is based on accepted AC-14A commit `c95ec1a4b2dbd2884a38758d0c89667f05e2d5b2`.
- Legacy evidence is frozen at repository `mhafez300300-byte/Elhafez-Tourism-Offline`, commit `e97fa6d9cb52acb22b676e1b975c1b2332bc9a13`, version `v32.5.66`.
- A target company, migration actor, complete explicit branch map, database backup, and maintenance window are approved.
- No production credentials are stored in the snapshot, config, repository, command history, or issue detail.

## Snapshot and source identity

1. Freeze writes in the legacy application.
2. Export once with `GET /api/data-protection/export-state`; do not query or depend on the legacy PostgreSQL schema.
3. Store the raw JSON in access-controlled temporary storage and calculate `sha256sum <snapshot.json>` before parsing it.
4. Record the exact byte hash in the run. Re-exporting or editing JSON creates a different source and must not resume the old run.
5. Prepare a config containing `targetCompanyId`, `actorId`, an explicit `branchMap`, and `allowUnscopedSourceRecords`. Unmapped branches are blockers, never guessed defaults.

## Rehearsal and execution

Use the non-HTTP runner commands `dry-run`, `execute`, `resume`, `status`, and `verify`, with `--snapshot`, `--config`, and (for continuation/status) `--run-id`.

1. Run `dry-run`; verify frozen source identity, raw SHA, JSON shape, company, actor, and every branch mapping.
2. Review every sanitized migration issue. Resolve blocking missing references, malformed decimals, ambiguous semantics, and unsupported constructs in source/config or an explicitly reviewed mapping decision—not by changing authoritative values.
3. Take a target backup and run `execute`. The 36 deterministic stages checkpoint each unit and record source-to-owner crosswalks.
4. On interruption, retain the same snapshot bytes and config and use `resume --run-id <id>`. Never delete owner records or checkpoints to retry.
5. Use `status --run-id <id>` to review checkpoints, rejected units, issues, and equivalence evidence.
6. Run `verify`. Financial Reporting must be rebuilt from imported owner evidence; legacy report rows are never imported as truth.

## Acceptance and equivalence

- Require exact authoritative counts/totals, GL base/native/FX evidence, reversal lineage, open Billing positions and allocations, Treasury evidence, advanced-owner balances, Procurement evidence, Tourism inventory/workflows, and company/branch segregation.
- No tolerance or floating-point correction is permitted. Every mismatch is stored as `EQUIVALENCE_MISMATCH` and blocks `READY`.
- Run the repository suite and confirm the AC-14 registry reports **40/40** executable Golden Scenarios (GS-001 through GS-040).
- Re-run the complete migration against a restored empty target. Crosswalks/checkpoints and owner idempotency must converge without duplicate economic effects.

## Abort, recovery, and rollback

Abort/no-go conditions include a source SHA change, source identity mismatch, unknown branch/company mapping, unbalanced authoritative journal, unresolved blocking issue, duplicate/conflicting target identity, broken reversal/allocation link, non-exact equivalence, any Golden Scenario failure, or any repository gate failure.

Before production traffic, rollback means discard the isolated target migration database and restore the pre-run backup. After traffic begins, do not erase economic history; use owner-approved reversal/correction workflows. Preserve the failed run, issues, checkpoints, logs, and SHA as audit evidence.

## Sign-off and final go/no-go

- [ ] Migration owner: frozen identity and SHA match.
- [ ] Accounting owner: all authoritative equivalence checks match exactly.
- [ ] Module owners: rejected/unsupported records are resolved or explicitly block go-live.
- [ ] Security owner: company/branch isolation and temporary-file handling accepted.
- [ ] Engineering owner: install, Change Safety, Prisma, typecheck, lint, architecture, tests, and diff checks pass.
- [ ] QA owner: GS-001..GS-040 is 40/40.
- [ ] Operations owner: backup, maintenance window, monitoring, abort, and recovery rehearsal accepted.
- [ ] Product owner: final explicit **GO** recorded. Any unchecked item means **NO-GO**.

## Production CLI

Run from the repository root after applying the additive AC-14 migrations. Every mutating command requires the frozen source identity explicitly; identity mismatches fail before owner import.

```bash
pnpm --filter @elhafez/api ac14 -- dry-run --snapshot /secure/export.json --config /secure/ac14.json --source-repository mhafez300300-byte/Elhafez-Tourism-Offline --source-commit e97fa6d9cb52acb22b676e1b975c1b2332bc9a13 --source-version 32.5.66
pnpm --filter @elhafez/api ac14 -- execute --snapshot /secure/export.json --config /secure/ac14.json --run-id <run-id> --source-repository mhafez300300-byte/Elhafez-Tourism-Offline --source-commit e97fa6d9cb52acb22b676e1b975c1b2332bc9a13 --source-version 32.5.66
pnpm --filter @elhafez/api ac14 -- resume --snapshot /secure/export.json --config /secure/ac14.json --run-id <run-id> --source-repository mhafez300300-byte/Elhafez-Tourism-Offline --source-commit e97fa6d9cb52acb22b676e1b975c1b2332bc9a13 --source-version 32.5.66
pnpm --filter @elhafez/api ac14 -- status --run-id <run-id>
pnpm --filter @elhafez/api ac14 -- verify --config /secure/ac14.json --run-id <run-id> --source-repository mhafez300300-byte/Elhafez-Tourism-Offline --source-commit e97fa6d9cb52acb22b676e1b975c1b2332bc9a13 --source-version 32.5.66
```

`verify` reads the existing run and owner evidence only. It does not accept or read a source snapshot and cannot invoke an owner import. `READY` requires all owner equivalence dimensions to match, executable GS evidence to be 40/40, reporting rebuild completion, zero unresolved issues, and a complete readiness checkpoint. `READY` is evidence only and does not perform production cutover.
