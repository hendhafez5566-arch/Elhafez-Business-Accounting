# Procurement + Tourism Legacy Parity Execution

## Mission

Rebuild the **Purchases & Suppliers** and **Tourism & Services** functional/UI/UX coverage from `hendhafez5566-arch/Elhafez-Tourism-Offline` inside `hendhafez5566-arch/Elhafez-Business-Accounting`.

- OLD is functional/UI/UX reference only.
- NEW is the architectural source of truth.
- Working branch: `feature/procurement-tourism-full-legacy-parity`.
- Do not modify or merge `main` during implementation/testing.
- Do not deploy to Railway or production.
- No legacy code copy/paste.
- No duplicate owners, tables, repositories, balances, invoice truth, party identity, permissions, or file stores.

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
| Customer / agent operational identity | canonical management owner + `party-registry` |
| Tourism financial orchestration | `tourism-finance-orchestration` + financial owners |
| Files / audit / user / branch scope | `platform-core` |
| Financial approvals | `financial-controls` |
| FX / GL | `currency-fx` / `general-ledger` |

## Phase 1 Inventory — Purchases & Suppliers

| Capability | Final implementation decision | Phase 1 |
|---|---|---|
| Supplier create/edit/profile/contact/category/credit days/notes | Reuse `supplier-management` + Party Registry | DONE |
| Search/filter/sort/status badges/loading/empty/error | Existing supplier UI extended using NEW primitives | DONE |
| Phone / WhatsApp | Uses canonical contact data only | DONE |
| Approval/rejection | Existing supplier-management permissions/lifecycle | DONE |
| Suspend/reactivate/hold | Existing safe lifecycle | DONE |
| Hard delete of linked supplier | Excluded; history retained | DONE / EXCLUDED |
| Supplier bank accounts | Existing supplier owner | DONE |
| Supplier 360 | Public-owner read model | DONE |
| Supplier PO history | Procurement owner | DONE |
| Supplier invoices/outstanding/due/overdue | Billing read model; overdue is derived, not stored | DONE |
| Supplier vouchers/payments/receipts | Treasury read model | DONE |
| Supplier advances | Billing truth referenced through Treasury evidence | DONE |
| Financial operations | Navigation to canonical accounting workspace; no supplier finance duplicate | DONE |
| Supplier evaluation | Existing owner | DONE |
| Supplier disputes/critical hold/release | Existing owners | DONE |
| Supplier documents | `EntityFileLinksApplicationService` / Platform Core | DONE |
| PR / RFQ / bids / comparison / award | Existing procurement sourcing | DONE |
| PO / approval / cancellation | Existing procurement finance | DONE |
| Receipt / correction | Existing procurement fulfillment | DONE |
| Purchase return | Dedicated workspace over immutable receipt correction; no return table | DONE |
| Supplier invoice conversion | Existing Billing flow | DONE |
| Direct purchase | Existing accounting/Billing flow | DONE |

## Phase 1 Inventory — Tourism & Services

| Capability | Final implementation decision | Phase 1 |
|---|---|---|
| Standalone service create/edit | Existing `standalone-services`; draft editing exposed | DONE |
| Service search/filter/status/lifecycle states | NEW UI primitives over existing owner | DONE |
| Customer / agent / traveler / supplier selection | Canonical owner-backed selectors | DONE |
| Service fulfillment and supplier confirmations | Existing `service-fulfillment` | DONE |
| Service vouchers / print / void | Existing `service-vouchers` | DONE |
| Service cancellation | Existing finance/fulfillment blocker orchestration | DONE |
| Service 360 | Operational + financial read composition | DONE |
| Service profitability | Derived from finance snapshot sale/cost; no duplicate financial truth | DONE |
| Customer invoice/outstanding | Billing-owned read | DONE |
| Supplier POs/invoices/outstanding | Procurement/Billing-owned reads | DONE |
| Collection | Existing Billing/Treasury party financial orchestration | DONE |
| Customer/agent advance refund | Existing Billing/Treasury/Financial Controls orchestration | DONE |
| Supplier settlement | Canonical accounting/Treasury workspace | DONE |
| Service documents | Platform Core entity file links | DONE |
| Programs lifecycle/edit/cancel | Existing tourism programs owner exposed in UI | DONE |
| Itinerary create/edit/read-only lifecycle | Existing itinerary owner | DONE |
| Booking create | Canonical customer/traveler selectors | DONE |
| Booking confirmation inventory | Contract/resource catalog selectors; no user-entered allocation ID | DONE |
| Flight/Visa booking allocation evidence | Required evidence propagated to canonical inventory/finance contract | DONE |
| Booking cancellation/completion | Existing finance blocker + lifecycle behavior | DONE |
| Contract supplier/program pickers | Canonical reads | DONE |
| Contract/resource catalog | Read model inside `tourism-contract-inventory` owner | DONE |
| Contract allocation / availability / stop-sale | Owner-backed selectors and existing APIs | DONE |
| Hotel commercial contract fields | Stored as versioned contract terms, not financial ledger truth | DONE |
| Flight commercial contract fields | Stored as versioned contract terms, not payable/payment truth | DONE |
| Transport / Visa capacity | Existing canonical inventory inputs | DONE |
| Contracted generic services | Existing generic service inventory API exposed in primary workspace | DONE |
| Duplicate generic service form | Removed from corrective section | DONE |
| Contract attachments | Platform Core file owner via service/supplier document workspaces where entity files are required; no new file store | DONE |

## Architecture Decisions Locked

1. Supplier balances are never stored in Supplier Management or UI.
2. Tourism profitability is read/derived from financial snapshots, not persisted again in Tourism UI.
3. Purchase returns do not create a second returns ledger; they use fulfillment correction evidence. If quantity is already invoiced, Billing must be corrected first.
4. Files are stored only by Platform Core; supplier/tourism controllers create entity-file links only.
5. Booking allocation IDs are generated internally by the booking/finance flow. Users select real contracts/resources, not internal orchestration IDs.
6. Flight block and visa allocations require their operational evidence references; the UI does not fabricate evidence from a resource ID.
7. Contract commercial data from OLD is preserved as versioned contract terms when it is descriptive/commercial. Invoices, liabilities, settlements, FX and profitability remain with financial owners.
8. Customer/agent collection and advance refund reuse existing Billing/Treasury/Financial Controls orchestration. Supplier settlement remains in Accounting/Treasury.
9. No database migration was required for the Phase 1 parity additions completed here.
10. No Railway, proxy, domain or production deployment configuration was changed.

## Canonical Routes After Phase 1

- `/procurement/suppliers`
- `/procurement/supplier-intelligence`
- `/procurement/supplier-documents` (hidden contextual route)
- `/procurement/sourcing`
- `/procurement/purchase-orders`
- `/procurement/returns`
- `/tourism/services`
- `/tourism/service-360` (hidden contextual route)
- `/tourism/service-documents` (hidden contextual route)
- `/tourism/programs`
- `/tourism/bookings`
- `/tourism/itinerary`
- `/tourism/contracts-inventory`
- `/accounting` for canonical supplier settlement/accounting operations
- `/crm/financial-action` is reused only as the existing party receivable/refund orchestration UI backed by Billing/Treasury/Financial Controls; it does not own financial truth.

No parallel legacy route was intentionally introduced for the two target sections.

## Phase 1 Status

**IMPLEMENTATION COMPLETE — UNVERIFIED**

The requested implementation batch is closed at the code level. This status means only that the intended implementation and architecture mapping are present on the feature branch.

It does **not** mean the code is type-safe, build-safe, lint-clean or test-passing yet.

### Explicitly not executed in Phase 1

- TypeScript/typecheck
- lint
- unit tests
- integration tests
- API tests
- architecture check
- Prisma generate/migration verification
- web/API build
- hosted verification workflow
- `pnpm verify`

These are intentionally deferred because the user requested testing as a separate stage.

## Phase 2 — Testing / Verification

**NOT STARTED**

When Phase 2 is explicitly started, perform targeted verification first and comprehensive verification last:

1. Prisma generate / migration state check.
2. Targeted TypeScript checks for changed API/web/modules.
3. Targeted module/unit/integration tests.
4. Permission + company/branch scope checks.
5. Booking inventory evidence and selectors.
6. Supplier documents / tourism documents file-link permissions and branch scope.
7. Supplier 360 Billing/Treasury read model and overdue derivation.
8. Purchase-return correction / invoiced-quantity guard.
9. Tourism Service 360 financial reads, collection/refund navigation, cancellation blockers.
10. Contract inventory catalog, versioned terms, generic service inventory, availability/allocation/stop-sale.
11. Route/dead-code/duplicate implementation review.
12. Web/API build and lint.
13. Hosted `ubuntu-latest` verification and final `pnpm verify` once.
14. Fix only failures caused by this mission or required to unblock verification.
15. Final literal OLD-vs-NEW page/button/icon/form/field/filter/action/menu/workflow/state audit.
16. Open a clear PR only after verification results are known.

Never claim a test passed unless it was actually executed.

## Git / Deployment State

- Work remains on `feature/procurement-tourism-full-legacy-parity`.
- `main` is not modified by this mission.
- No merge to `main` has been performed.
- No Railway/production deployment has been performed.
- PR remains deferred until the separate verification stage.
