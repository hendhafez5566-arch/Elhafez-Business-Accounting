## Scope

- Requested change:
- Owning module:
- Explicitly out of scope:
- Change-scope manifest: `.changes/<change-id>.json`

## Blast radius

- [ ] Exactly one change-scope manifest is included.
- [ ] Every changed business module is listed in `allowedModules`.
- [ ] Every changed non-module path is listed in `allowedPaths`.
- [ ] Any protected global path is explicitly declared with a real reason.
- [ ] No accepted historical migration was edited/deleted/renamed.
- [ ] No generated/build/cache/secrets artifact is committed.
- [ ] No public API symbol was removed unless explicitly approved as a breaking change.

## Architecture / ownership

- [ ] I read `AI_CHANGE_PROTOCOL.md` and `AGENTS.md`.
- [ ] No module writes another module's tables/repositories.
- [ ] Cross-module calls use public package/application boundaries only.
- [ ] Compile-time dependency DAG remains valid.
- [ ] Table ownership is unique.
- [ ] No direct Prisma access crosses module ownership.
- [ ] Domain code remains independent from Prisma/Nest/UI frameworks.
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
- [ ] `pnpm change-safety:check` passes.
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
- Protected paths touched and reason:
- Known blockers/limitations:
