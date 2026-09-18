# ELHAFEZ BUSINESS ACCOUNTING — AC-01 Architecture

Status: AC-01 deliverable; documentation only. AC-00 is the approved behavioral baseline. No implementation, Prisma model, migration, or accounting code is authorized here.

## Architectural decision

The accounting product is a modular monolith. Each module owns its write model and tables. A module may use another module only through a public application service, versioned contract, or domain/integration event. It may never write another module's tables, import its private internals, or infer financial truth from a copied balance.

The journal is the final accounting record; source documents and subledgers remain the authoritative lifecycle records. Billing & Subledgers is the sole owner of the economic allocation record and its AR/AP/advance/realized-FX effect. Treasury owns cash instruments and keeps only immutable allocation references or rebuildable projections. Posted records are immutable. Correction is by linked reversal or adjustment. Reporting owns projections, never source balances.

## Invariants

1. General Ledger alone posts/reverses journals and owns journal lines.
2. Every posted journal balances in base currency and has exactly one economic side per line.
3. Subledger control lines carry the party identity supplied by the owning subledger.
4. Period Control authorizes posting dates; GL synchronously imports only Period Control's public port and enforces the returned authorization. Period Control never imports GL.
5. Invoice, settlement, netting, recognition, and procurement lifecycles are independently owned and linked by immutable references.
6. Billing-owned allocations are deterministic, traceable, reversible, oldest-due by default, source-aware, and FX-aware. Treasury and Party Accounting retain references only.
7. Advances are first-class positions; they are not untracked residuals.
8. Operational allocation is not automatically a payable. Procurement policy decides actualization.
9. Inventory is consumed before external procurement for shortage, unless an explicit authorized mode says otherwise.
10. Cancellation is a workflow of blocker queries and compensating commands; it never deletes posted history.
11. Server-side authorization, branch scope, approval limits, no-self-approval, and immutability are mandatory.
12. Financial Controls detects divergence but never silently repairs economic records.

## Module boundaries

The definitive list and public surface are in `ACCOUNTING-MODULE-MAP.md`; single ownership is in `ACCOUNTING-DATA-OWNERSHIP.md`; legal dependency directions are in `ACCOUNTING-DEPENDENCY-GRAPH.md`.

## Dependency and consistency model

Five relationship types are distinct:

1. **Compile-time/module import:** a directed edge from consumer to provider. Only these edges participate in the module DAG.
2. **Shared-contract dependency:** both modules may import neutral DTO/event definitions from the approved shared contracts package; this is not a module-to-module edge.
3. **Event flow:** immutable events are published without importing a consumer module.
4. **Orchestration flow:** a caller/composition layer invokes public ports in sequence; participating modules do not import one another in reverse.
5. **Read-model/projection consumption:** a consumer reads a rebuildable projection fed by events/contracts, never another module's tables or repository.

The authoritative compile-time DAG and its topological proof are in ACCOUNTING-DEPENDENCY-GRAPH.md.

- Within one module: one database transaction.
- Cross-module synchronous command: only the declared DAG direction is allowed; caller receives an immutable result/reference and callee owns its transaction.
- Cross-module event: delivery semantics and global idempotency remain an open decision. Consumers must nevertheless define a local deduplication key before implementation.
- Multi-step workflows: orchestration state belongs to the initiating domain (Tourism/Procurement) or Financial Controls for close/netting; compensation is explicit.
- No distributed transaction and no silent fallback.

## Accounting posting protocol

Source owners request posting using `PostingInstruction.v1`; they never send raw database writes. GL validates accounts, sides, base amounts, control dimensions, period authorization, branch/company scope, source uniqueness, and balance. It returns a journal reference. Reversal references the original journal and preserves history.

## Security and audit

All commands carry company, branch, actor, permission context, correlation, causation, source reference, expected revision, and idempotency key where the contract requires it. Audit records actor, decision, before/after lifecycle state, approvals, posting/reversal references, and rejection reason. Authorization is enforced in application services, not only UI.

## Explicit non-goals

AC-01 does not select tables, Prisma schemas, controllers, transports, queues, migration mechanics, statutory e-invoicing, bank APIs, consolidation, or full outbox semantics. These remain later implementation work or open decisions.
