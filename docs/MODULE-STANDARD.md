# Module Standard

## 1. Decide ownership before creating code

Before creating or modifying a module, read:

- `docs/BUSINESS-MODULE-ARCHITECTURE.md`
- `docs/BUSINESS-MODULE-ROUTING.md`

A suite/workspace/menu section is not automatically a module.

Create a new module only when the requested behavior has a distinct business/data lifecycle and the canonical routing map identifies that owner as PLANNED.

If the map identifies an EXISTING owner, extend that owner instead of creating a parallel implementation.

If ownership is not mapped, stop for an architecture decision.

## 2. Module construction

1. Copy `modules/_template`; never hand-invent a layout.
2. Use the exact canonical module name from the business architecture unless an owner-approved architecture change renames it.
3. Rename the placeholder and set a directory-matching `name` in `module.json`.
4. Declare all physical tables in `ownedTables`; use a unique module prefix for each table.
5. Keep every non-public type private. Consumers import only the package root (`@elhafez/<module>`).
6. Make use cases application services. Controllers/adapters invoke only those services.
7. Add unit tests and architectural tests before registration in `apps/api`.
8. Run `pnpm verify` before a module change is merged.

## 3. Ownership boundary

A module owns its:
- domain model;
- application use cases;
- persistence/repository adapters;
- physical tables and migrations;
- public API/contracts it exposes;
- business invariants for its truth.

IDs referencing another module are opaque external references, not permission to join or mutate its tables.

A module may consume another owner only through that owner's public package/API or approved versioned event/contract.

## 4. Shared module rule

A shared module is implemented **once** and may be presented in multiple suites.

Example: `tourism-contract-inventory` may be shown under Hajj & Umrah and Tourism & Services, but both suites call the same owner.

Never duplicate a shared owner merely to make navigation look locally self-contained.

## 5. Projection/composition rule

Dashboards, work centers, readiness views, and reports may aggregate multiple owners.

They must:
- consume public APIs/events/read models;
- remain rebuildable when defined as projections;
- never become source truth for the underlying business entities;
- never use direct cross-module Prisma reads as a shortcut.


## Fail-closed module scope metadata

Every module introduced after AE-01 must declare the following in `module.json`:

- `dataScope`: one of `PLATFORM`, `COMPANY`, or `COMPANY_BRANCH`;
- `branchScopedTables`: required for `COMPANY_BRANCH`, containing only tables in that module's `ownedTables`;
- `criticalInvariants`: at least one explicit business invariant that the module's tests must preserve.

The repository engineering-integrity gate validates this contract for newly added modules. Do not bypass it by placing business state in apps, shared packages, or an existing unrelated module.
