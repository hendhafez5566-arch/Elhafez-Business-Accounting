# System Blueprint

ELHAFEZ is a modular monolith for accounting, tourism, Hajj, and Umrah operations. Phase 0 creates no business capability. Its purpose is to make later bounded contexts independently buildable and safely integrable.

## Runtime shape

`apps/web` is the future React + TypeScript client boundary. `apps/api` is the NestJS composition root. It registers modules but contains no business rules. PostgreSQL is accessed through Prisma adapters owned by the relevant module. `packages/contracts` carries stable cross-module contracts/events; `packages/core` contains only generic primitives.

## Dependency direction

```text
web -> api -> module public APIs -> core/contracts
                         module infrastructure -> PostgreSQL/Prisma
```

Modules never depend on each other's internals. A module may publish a versioned event or offer a public application-service contract. The dependency graph must remain acyclic.

## Future bounded contexts

Accounting, treasury, customer, supplier, tourism, Hajj, Umrah, booking, and identity are deliberately absent. Each will be introduced as a separate module from the official template.
