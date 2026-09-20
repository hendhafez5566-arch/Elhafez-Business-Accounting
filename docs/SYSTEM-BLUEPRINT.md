# System Blueprint

ELHAFEZ is a TypeScript modular monolith for Accounting & Finance, Hajj & Umrah, Tourism & Services, CRM & Sales, Suppliers & Procurement, Management & Control, and System Administration.

The repository foundation is intentionally designed so product suites can contain multiple independently owned modules while still appearing as one coherent system to the user.

## Runtime shape

`apps/web` is the React + TypeScript client boundary. `apps/api` is the NestJS composition root. It registers modules but contains no business rules. PostgreSQL is accessed through Prisma adapters owned by the relevant module. `packages/contracts` carries stable cross-module contracts/events; `packages/core` contains only generic primitives.

## Dependency direction

```text
web -> api -> module public APIs -> core/contracts
                         module infrastructure -> PostgreSQL/Prisma
```

Modules never depend on each other's internals. A module may publish a versioned event or offer a public application-service contract. The compile-time dependency graph must remain acyclic.

## Product suites versus modules

A **suite/system** is a user-facing workspace. A **module** is the code/data owner.

One suite may contain many modules, and one shared module may be surfaced in more than one suite without duplication.

Canonical post-AC-14 suites:

1. Hajj & Umrah
2. Tourism & Services
3. CRM & Sales
4. Suppliers & Procurement
5. Accounting & Finance
6. Management & Control
7. System Administration

The exact module ownership, existing/planned status, and cross-suite reuse rules are canonical in:

- `docs/BUSINESS-MODULE-ARCHITECTURE.md`
- `docs/BUSINESS-MODULE-ROUTING.md`

Coding agents must route a requested feature through those files before editing.

## Accepted shared owners

Some accepted modules already serve more than one future suite.

Examples:

- `tourism-contract-inventory` is the single canonical owner for tourism/Hajj/Umrah contracts, allotment, capacity, and inventory.
- `procurement-finance` remains the accepted owner for supplier commitments and purchase-order financial/economic records.
- `platform-core` remains the accepted owner for users, roles, companies, branches, sessions, audit, files, notifications, and configuration.
- accepted accounting modules remain the sole owners of financial truth.

Navigation may regroup these capabilities, but data ownership must not move merely because the menu changes.
