# Module Standard

1. Copy `modules/_template`; never hand-invent a layout.
2. Rename the placeholder and set a directory-matching `name` in `module.json`.
3. Declare all physical tables in `ownedTables`; use a unique module prefix for each table.
4. Keep every non-public type private. Consumers import only the package root (`@elhafez/<module>`).
5. Make use cases application services. Controllers/adapters invoke only those services.
6. Add unit tests and architectural tests before registration in `apps/api`.
7. Run `pnpm verify` before a module change is merged.

A module owns its data lifecycle and migrations. IDs referencing another module are opaque external references, not permission to join or mutate its tables.
