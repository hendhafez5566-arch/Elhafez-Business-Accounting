# Change Policy

Changes must be small, owned, documented, and compatible at public boundaries. Breaking a public contract requires a new version/contract and a migration plan; consumers are not changed by reaching into internals.

Do not modify `packages/core`, `packages/contracts`, or shared composition merely to address a local module problem. First use an adapter, a module-local policy, or a new explicit public contract. Any architectural exception needs an ADR documenting owner, scope, alternatives, expiry, and removal plan.

Before commit: inspect the diff, update relevant standards, add tests, and pass `pnpm verify`.
