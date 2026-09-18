# Agent Operating Rules

1. Work only on the requested branch; inspect `git status` before changes.
2. A module owns its code, schema models, migrations, and data access. Do not write another module's tables.
3. Import another module only through its package root/public contract. Never import `src/domain`, `src/application`, or `src/infrastructure` from another module.
4. Use public application services for synchronous collaboration and versioned events for asynchronous collaboration.
5. Preserve an acyclic dependency graph. `packages/core` and `packages/contracts` must never depend on modules.
6. Do not alter core/shared architecture to solve a local module concern; add an adapter within the module instead.
7. New modules must originate from `modules/_template`, complete `module.json`, pass `pnpm architecture:check`, and include tests.
8. Run `pnpm verify` before committing. No business capability belongs in Phase 0.
