# Architecture

## Principles

The system is a TypeScript monorepo and modular monolith: one deployable backend, multiple strongly bounded modules. Cohesion inside a module is preferred over sharing implementation between modules.

## Layers within a module

- `public/`: the only external API; exports contracts, facade/application service, and Nest module registration.
- `application/`: use-case orchestration and transactions.
- `domain/`: entities, value objects, domain policies, and events.
- `infrastructure/`: Prisma repositories, external adapters, and persistence implementation.

Dependencies flow inward. Domain code does not import Nest, Prisma, HTTP, or another module. Infrastructure implements ports defined inward. API is a composition root, not a business layer.

## Prohibited dependencies

No module may import another module's source directory, access its repositories, or read/write its tables. Core and contracts may not import application modules. Circular dependencies are rejected by lint and must be fixed at the boundary—not bypassed.
