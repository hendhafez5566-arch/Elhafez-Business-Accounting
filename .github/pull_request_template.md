## Scope

- Requested change:
- Owning module:
- Explicitly out of scope:

## Architecture / ownership

- [ ] I read `AI_CHANGE_PROTOCOL.md` and `AGENTS.md`.
- [ ] No module writes another module's tables/repositories.
- [ ] Cross-module calls use public package/application boundaries only.
- [ ] Compile-time dependency DAG remains valid.
- [ ] No unrelated Core/shared/app-shell/global-style change was used as a workaround.
- [ ] The change modifies the canonical path; it does not add patch-on-patch duplication.

## Data / financial safety

- [ ] Migration is additive; accepted historical migrations were not rewritten.
- [ ] Company/branch isolation is preserved.
- [ ] Financial quantities use exact decimals where relevant.
- [ ] Idempotency/concurrency/history rules are covered where relevant.
- [ ] No financial/economic history is silently deleted.

## Verification

- [ ] Focused module tests pass.
- [ ] `pnpm prisma:generate` passes when applicable.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.
- [ ] `pnpm architecture:check` passes.
- [ ] `pnpm test` passes.
- [ ] `pnpm verify` passes when defined/required.
- [ ] `git diff --check` passes.
- [ ] Final changed-file review contains no generated/unrelated artifacts.

## Evidence

- Files changed:
- Tests added/updated:
- Migration:
- Public API impact:
- Known blockers/limitations:
