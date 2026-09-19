# Agent Operating Rules

Before editing any code, every coding agent MUST read:

1. `AI_CHANGE_PROTOCOL.md`
2. `PROJECT_STATE.md`
3. `docs/ARCHITECTURE.md`
4. `docs/MODULE-STANDARD.md`
5. `docs/TESTING-STANDARD.md`

For accounting/financial work also read the relevant `docs/accounting/*` architecture, ownership, dependency, contracts and coverage files.

Before editing, create exactly one change-scope manifest under `.changes/<change-id>.json` for the PR. Declare the owning modules, explicitly allowed non-module paths, and any protected paths that truly must change. The CI change-safety gate validates this manifest against the real diff.

## Mandatory rules

1. Work only on the requested branch; inspect `git status` before changes.
2. Implement only the requested behavior. Keep the blast radius minimal.
3. A module owns its code, schema models, migrations, and data access. Do not write another module's tables.
4. Import another module only through its package root/public contract. Never import another module's private `src/domain`, `src/application`, or `src/infrastructure`.
5. Use public application services for synchronous collaboration and approved shared/versioned contracts/events for asynchronous collaboration.
6. Preserve an acyclic compile-time dependency graph. `packages/core` and `packages/contracts` must never depend on business modules.
7. Do not alter core/shared architecture, global lint rules, app shell, design tokens, or unrelated modules to solve a local concern.
8. New modules must originate from `modules/_template`, complete `module.json`, follow the ownership registry, and include tests before registration.
9. Do not create patch-on-patch implementations. Modify the canonical path and remove obsolete local duplication.
10. Do not use floating point for accounting/financial quantities.
11. State-changing financial/economic workflows must use durable idempotency and concurrency-safe persistence where races matter.
12. Never erase financial/economic history to implement cancellation or correction.
13. UI changes are local by default; do not change sidebar/shell/global CSS for a local feature.
14. Never weaken tests, lint, type safety, architecture checks, or migrations to make CI green.
15. Run focused tests plus repository quality gates before completion.
16. Inspect final changed filenames and remove generated/unrelated artifacts.
17. Never edit an accepted historical Prisma migration. Schema evolution is additive through a new migration.
18. Public package exports are backward-compatible by default. Removing a public symbol requires explicit breaking-change approval in the change manifest.
19. Protected global paths (shell, global CSS, architecture/governance, workflows, module manifests) may change only when explicitly declared with a reason.
20. If correct implementation requires violating these rules, STOP and report the architectural blocker instead of bypassing it.

Required repository gates:

```bash
pnpm change-safety:check
pnpm verify
```

Also run Prisma generation, focused tests, and `git diff --check` where applicable.

For project-manager continuity, read `PROJECT_MANAGER_HANDOFF.md`; coding agents should not modify project phase status unless the task explicitly includes closing/updating a phase.
