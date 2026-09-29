# Procurement + Tourism Legacy Parity Execution

## Mission

Rebuild the **Purchases & Suppliers** and **Tourism & Services** functional/UI/UX coverage from `hendhafez5566-arch/Elhafez-Tourism-Offline` inside `hendhafez5566-arch/Elhafez-Business-Accounting`.

- OLD is functional/UI/UX reference only.
- NEW is the architectural source of truth.
- Working branch: `feature/procurement-tourism-full-legacy-parity`.
- Do not modify or merge `main` during implementation/testing.
- Do not deploy to Railway or production.
- No legacy code copy/paste.
- No duplicate owners, tables, repositories, balances, invoice truth, party identity, permissions, contract owners or file stores.

## Canonical Ownership

| Business truth | Canonical owner |
|---|---|
| Party identity/contact | `party-registry` |
| Supplier profile/lifecycle/approval/banks | `supplier-management` |
| Supplier evaluation | `supplier-evaluation` |
| Supplier disputes | `supplier-disputes` |
| PR / RFQ / bids / comparison / award | `procurement-sourcing` |
| Purchase order / supplier commitment | `procurement-finance` |
| Receipt / execution / correction | `procurement-fulfillment` |
| Supplier invoice / payable / advance | `billing-subledgers` |
| Cash / bank / settlement / payment / refund | `treasury-settlement` |
| Tourism standalone service | `standalone-services` |
| Tourism program / booking / itinerary | `tourism-programs` / `tourism-bookings` / `tourism-itineraries` |
| Tourism contracts / allotments / inventory | `tourism-contract-inventory` |
| Service supplier confirmation / delivery | `service-fulfillment` |
| Voucher | `service-vouchers` |
| Traveler/passport | `traveler-management` |
| Tourism financial orchestration | `tourism-finance-orchestration` + financial owners |
| Files / audit / user / branch scope | `platform-core` |
| Financial approvals | `financial-controls` |
| FX / GL | `currency-fx` / `general-ledger` |

## Phase 1 Inventory — Purchases & Suppliers

| Capability | Final implementation decision | Phase 1 |
|---|---|---|
| Supplier create/edit/profile/contact/category/credit days/notes | Reuse `supplier-management` + Party Registry | DONE |
| Search/filter/sort/status/loading/empty/error | Existing NEW supplier UI | DONE |
| Approval/rejection/suspend/reactivate/hold | Existing supplier lifecycle/permissions | DONE |
| Hard delete of linked supplier | Excluded; history retained | DONE / EXCLUDED |
| Supplier bank accounts | Existing supplier owner | DONE |
| Supplier 360 | Public-owner read model | DONE |
| Supplier PO history | Procurement owner | DONE |
| Supplier invoices/outstanding/due/overdue | Billing read model; overdue derived, not stored | DONE |
| Supplier vouchers/payments | Treasury read model | DONE |
| Supplier advances | Billing truth referenced through Treasury evidence | DONE |
| Supplier evaluation/disputes/critical holds | Existing owners | DONE |
| Supplier documents | Platform Core entity-file links on `SUPPLIER` | DONE |
| PR / RFQ / bids / comparison / award | Existing Procurement Sourcing | DONE |
| PO / approval / cancellation | Existing Procurement Finance | DONE |
| Receipt / correction | Existing Procurement Fulfillment | DONE |
| Purchase return | Workspace over immutable receipt correction; no returns ledger | DONE |
| Supplier invoice conversion / direct finance | Existing Billing/Accounting flows | DONE |

## Phase 1 Inventory — Tourism & Services

| Capability | Final implementation decision | Phase 1 |
|---|---|---|
| Standalone service create/edit/search/lifecycle | Existing `standalone-services` + NEW UI | DONE |
| Customer / agent / traveler / supplier selection | Canonical owner-backed selectors | DONE |
| Service fulfillment and supplier confirmations | Existing `service-fulfillment` | DONE |
| Service vouchers | Existing `service-vouchers` | DONE |
| Service cancellation | Existing blocker/finance orchestration | DONE |
| Service 360 / profitability | Operational + financial read composition; derived only | DONE |
| Customer invoice/outstanding | Billing-owned read | DONE |
| Supplier PO/invoice/outstanding | Procurement/Billing-owned reads | DONE |
| Collection | Existing Billing/Treasury party orchestration | DONE |
| Customer/agent advance refund | Existing Billing/Treasury/Financial Controls orchestration | DONE |
| Supplier settlement | Canonical Accounting/Treasury workspace | DONE |
| Service documents | Platform Core entity-file links on `TOURISM_SERVICE` | DONE |
| Programs / itinerary lifecycle | Existing general-tourism owners | DONE |
| Booking create | Canonical customer/traveler selectors | DONE |
| Booking confirmation inventory | Contract/resource catalog selectors; allocation ID internal | DONE |
| Flight/Visa allocation evidence | Real operational evidence required | DONE |
| Booking cancellation/completion | Existing lifecycle/finance blockers | DONE |
| Contract supplier/program pickers | Canonical reads | DONE |
| Contract/resource catalog | Read model inside contract-inventory owner | DONE |
| Availability / allocation / release / stop-sale | Existing canonical APIs + selectors | DONE |
| Hotel base commercial terms | Versioned contract terms | DONE |
| Hotel dated/seasonal room rates | Structured versioned amendment with effective period | DONE |
| Flight return leg/ticket deadline/fare/baggage/cost input | Versioned commercial terms | DONE |
| Transport route/vehicle metadata/commercial price | Structured versioned commercial amendment | DONE |
| Visa service label/processing days/commercial price | Structured versioned commercial amendment | DONE |
| Transport / Visa capacity | Existing canonical inventory records | DONE |
| Contracted generic services | Existing generic service inventory API in primary workspace | DONE |
| Duplicate generic service form | Removed from corrective creation path | DONE |
| Contract attachments | Platform Core entity-file links directly on `TOURISM_CONTRACT` | DONE |
| Contract file authorization | Authenticated company/branch scope plus relevant Tourism/Hajj contract-consumer permissions | DONE |

## Architecture Decisions Locked

1. Supplier balances are never stored in Supplier Management or supplier UI.
2. Tourism profitability is read/derived from canonical financial snapshots, not persisted again in Tourism.
3. Purchase returns do not create a second returns ledger; they use fulfillment correction evidence.
4. Files are stored only by Platform Core. Supplier, service and contract features keep entity-file links only.
5. Booking allocation IDs are generated internally. Users select contracts/resources rather than inventing orchestration IDs.
6. Flight block and visa allocations require operational evidence references; resource IDs are not fabricated as evidence.
7. Commercial/descriptive contract data is preserved as versioned terms. Invoices, liabilities, settlements, FX and profitability remain with financial owners.
8. Customer/agent collection and advance refund reuse existing Billing/Treasury/Financial Controls orchestration. Supplier settlement remains in Accounting/Treasury.
9. The canonical supplier selected on a contract is the provider Party/Supplier identity. Hotel/vehicle/flight/resource labels are operational references and do not create duplicate Party identities.
10. OLD contract-level quick-create supplier behavior is intentionally not reproduced inside Tourism; supplier creation/dedup stays with Supplier Management / Party Registry.
11. Hajj/Umrah-specific readiness remains with the existing `hajj-umrah-readiness` owner; general Tourism does not create a competing readiness/task store.
12. No database migration was required for this Phase 1 parity batch.
13. No Railway, proxy, domain or production deployment configuration was changed.

## Canonical Routes After Phase 1

- `/procurement/suppliers`
- `/procurement/supplier-intelligence`
- `/procurement/supplier-documents` — hidden contextual route
- `/procurement/sourcing`
- `/procurement/purchase-orders`
- `/procurement/returns`
- `/tourism/services`
- `/tourism/service-360` — hidden contextual route
- `/tourism/service-documents` — hidden contextual route
- `/tourism/programs`
- `/tourism/bookings`
- `/tourism/itinerary`
- `/tourism/contracts-inventory` — includes canonical contract documents and versioned parity amendments
- `/accounting` — canonical supplier settlement/accounting operations
- `/crm/financial-action` — reused existing party collection/refund orchestration; not a financial owner

`/hajj-umrah/contracts-inventory` deliberately renders the same shared Contract Inventory owner and component. It is not a second data owner and was not introduced by this target-section migration.

## Phase 1 Status

**IMPLEMENTATION COMPLETE — UNVERIFIED**

The implementation batch and focused literal OLD → NEW mapping are closed at code level. This does **not** mean the branch is type-safe, build-safe, lint-clean or test-passing.

### Explicitly not executed in Phase 1

- TypeScript / typecheck
- lint
- unit tests
- integration tests
- API tests
- permission tests
- architecture checks
- Prisma generate / migration verification
- web/API build
- hosted verification workflow
- `pnpm verify`

These are intentionally deferred because the user requested testing as a separate stage.

## Phase 2 — Testing / Verification

**NOT STARTED**

When explicitly started:

1. Prisma generate / migration-state check.
2. Targeted TypeScript checks for changed API/web/modules.
3. Targeted module/unit/integration tests.
4. Permission + company/branch scope checks, including contract/supplier/service files.
5. Booking inventory evidence/selectors.
6. Supplier 360 Billing/Treasury read model and overdue derivation.
7. Purchase-return correction/invoiced-quantity guards.
8. Tourism Service 360 financial reads and cancellation blockers.
9. Contract inventory catalog, versioned commercial terms, contract documents, generic service inventory, availability/allocation/stop-sale.
10. Route/dead-code/duplicate implementation review.
11. Web/API build and lint.
12. Hosted `ubuntu-latest` verification and final `pnpm verify` once.
13. Fix only failures caused by this mission or required to unblock verification.
14. Open a PR only after verification results are known.

Never claim a test passed unless it was actually executed.

## Git / Deployment State

- Work remains on `feature/procurement-tourism-full-legacy-parity`.
- `main` is not modified by this mission.
- No merge to `main` has been performed.
- No Railway/production deployment has been performed.
- PR remains deferred until the separate verification stage.
