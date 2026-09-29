# Procurement + Tourism Legacy Parity Execution

## Mission

Rebuild the **Purchases & Suppliers** and **Tourism & Services** functional/UI/UX coverage from `hendhafez5566-arch/Elhafez-Tourism-Offline` inside `hendhafez5566-arch/Elhafez-Business-Accounting`.

- OLD is a functional/UI/UX reference only.
- NEW is the architectural source of truth.
- Working branch: `feature/procurement-tourism-full-legacy-parity`.
- Never modify/merge `main` in this mission.
- Never deploy to Railway or production.
- Never copy legacy implementation code.
- Never create duplicate owners, repositories, tables, financial truth, attachments, identity, permissions, or cross-module direct DB reads.
- Cross-module integration must use public application services/APIs, read models, or orchestration.
- Existing migrations are immutable; any DB change must be a new migration only.

## Canonical Ownership

The mandatory NEW routing guide (`docs/BUSINESS-MODULE-ROUTING.md`) has been reviewed and is authoritative for this work.

| Business truth | Canonical owner |
|---|---|
| Party identity/contact | `party-registry` |
| Supplier operational profile/lifecycle/approval/banks | `supplier-management` |
| Supplier evaluation | `supplier-evaluation` |
| Supplier disputes | `supplier-disputes` |
| PR / RFQ / bids / quote comparison / sourcing award | `procurement-sourcing` |
| Purchase order / supplier commitment | `procurement-finance` |
| Receiving / procurement execution evidence | `procurement-fulfillment` |
| Supplier invoice/payable | `billing-subledgers` + existing procurement-finance contracts |
| Supplier payment/refund/cheque/cash/bank | `treasury-settlement` |
| General tourism standalone service | `standalone-services` |
| Tourism program / booking / itinerary | `tourism-programs` / `tourism-bookings` / `tourism-itineraries` |
| Tourism contract/allotment/inventory | `tourism-contract-inventory` |
| Supplier confirmation / service fulfillment | `service-fulfillment` |
| Voucher | `service-vouchers` |
| Traveler/passport | `traveler-management` |
| Customer operational identity | `customer-management` + `party-registry` |
| Accounting workflow for tourism | `tourism-finance-orchestration` and accounting owners |
| Files/audit/users/scoping | `platform-core` |
| Financial approvals | `financial-controls` |
| FX | `currency-fx` |
| GL | `general-ledger` |

## Legacy Evidence Reviewed

Reviewed directly from OLD:

- recursive repository tree;
- `src/core/umrah/procurement.ts`;
- `src/crm/party360.ts`;
- `src/commercial/vendor-owner.ts` (confirmed intentionally disabled legacy Vendor Center shell; not a feature source to reproduce);
- `src/commercial/pages.ts`;
- `scripts/umrah-ui-parity-smoke.mjs`.

Important OLD behaviors retained as requirements, not copied as code:

- Supplier “More/360” concepts: edit, phone/WhatsApp, documents, suspend/reactivate, guarded deletion, account/transaction-linked drill downs.
- Supplier history must be preserved while lifecycle changes stop new operations.
- Supplier procurement history includes POs, supplier commitments, contract links and payment/invoice document access.
- Procurement commitment/cancellation must respect downstream invoice/receipt/execution evidence.
- Tourism/Umrah UI historically exposed grouped workspaces for contracts/inventory, programs, bookings, travelers, visas, flights, transport, costing/procurement, operations, documents/control/settings.
- Program/service flows use guarded lifecycle transitions rather than deleting financial history.

Still queued for literal legacy extraction:

- focused OLD Umrah `ui-pages.ts`, `forms.ts`, `operations.ts`, `workflow.ts` sections;
- supplier/party browser smoke references;
- Umrah workflow smoke references;
- remaining old buttons/menus/fields/states used by the two requested scopes.

## NEW Evidence Reviewed

Confirmed existing implementations that must be reused rather than rebuilt:

### Supplier / Procurement

- `supplier-management` already owns supplier identity linkage, lifecycle, approval, categories, credit days, contact/notes, bank accounts, holds/history.
- `SupplierIntelligenceReadModelService` already composes Supplier 360 information through public owners: supplier profile, evaluation history, dispute history, procurement economic metrics, fulfillment timing metrics, active holds.
- `supplier-intelligence-page.tsx` already provides Arabic Supplier 360 evaluation/dispute workflows.
- `procurement-sourcing` already implements PR → submit → approval/rejection → RFQ → supplier invitation → bids → deterministic quote comparison → award → PO creation through the canonical procurement owner.
- `procurement-pages.tsx` already implements PO create/edit/approve/cancel, receipt evidence, receipt corrections, received-quantity-to-supplier-invoice conversion through Billing, and direct purchases through the accounting owner.

### Tourism / Services

- `standalone-services` is the canonical standalone tourism-service owner.
- Backend already has optimistic-revision `updateDraft`; this existed before this migration but was not exposed by the tourism UI.
- `tourism-services` workspace already uses service fulfillment, immutable vouchers, supply planning, supplier confirmation, delivery evidence, cancellation orchestration and durable finance integration.
- Routes already separate standalone services, tourism programs, bookings, itineraries and contract inventory instead of creating a legacy monolith.

## Rolling Inventory / Decisions

Status: `DONE` = implementation/reuse decision complete; `IN PROGRESS` = active parity work; `REUSE` = NEW already covers it; `EXCLUDE` = legacy behavior deliberately not transferred because it violates NEW rules.

### Purchases & Suppliers

| Legacy capability | Decision / owner | Status |
|---|---|---|
| Supplier create/edit/profile/contact/category/status/credit days/notes | Reuse/extend `supplier-management` + Party Registry | REUSE |
| Supplier search | Existing backend + UI | REUSE |
| Supplier status/approval filters and sorting | Extended existing supplier UI | DONE |
| Loading/empty/error states | Extended existing supplier UI using NEW Design System | DONE |
| Phone / WhatsApp shortcuts | Added over canonical Party contact data; no duplicate identity | DONE |
| Approval/rejection | Existing supplier-management backend permission checks | REUSE |
| Suspend/hold/reactivate | Existing supplier-management lifecycle | REUSE |
| Unsafe hard delete | Do not reproduce. Linked supplier history remains retained; lifecycle controls stop new use | EXCLUDE |
| Supplier banks | Existing supplier-management APIs | REUSE |
| Supplier 360 | Existing Supplier Intelligence read model/page; continue literal parity review for documents/financial drill-down | IN PROGRESS |
| Supplier evaluation | Existing `supplier-evaluation` | REUSE |
| Supplier disputes | Existing `supplier-disputes` | REUSE |
| PR/RFQ/bids/comparison/award | Existing `procurement-sourcing` | REUSE |
| PO/commitment | Existing `procurement-finance` exposed through procurement operations | REUSE |
| Receiving/corrections | Existing `procurement-fulfillment` | REUSE |
| Supplier invoice conversion | Existing Billing-owned flow from received PO quantity | REUSE |
| Direct purchase | Existing Billing-backed flow | REUSE |
| Supplier payable/balance/advance/payment/cheque | Must stay Billing/Treasury-owned; Supplier 360 composition parity still under review | IN PROGRESS |
| Shared attachments/documents | Must reuse Platform Core; literal UI parity still under review | IN PROGRESS |
| Purchase returns | Canonical owner/available operation still being reviewed | IN PROGRESS |

### Tourism & Services

| Legacy capability | Decision / owner | Status |
|---|---|---|
| Service create | Existing standalone-services | REUSE |
| Draft service edit | Backend existed; UI now exposes canonical revision-backed edit flow | DONE |
| Search/status filter/sort | Added to existing tourism service workspace | DONE |
| Loading/empty/error states | Existing + extended result empty state | DONE |
| Service type/date/period/quantity/customer/debtor/beneficiary/sale/discount/currency/financial terms | Existing canonical service revision, now also used for edit | REUSE/DONE |
| Supplier/supply planning | Existing contract inventory + supply planning | REUSE |
| Supplier confirmation/delivery | Existing `service-fulfillment` | REUSE |
| Voucher issue/print/void | Existing `service-vouchers` | REUSE |
| Service cancellation with finance/fulfillment blockers | Existing orchestration | REUSE |
| Service history/activity | Existing immutable history | REUSE |
| Programs/bookings/itineraries/contracts inventory | Existing dedicated tourism owners/routes | REUSE; literal OLD UI parity continues |
| Traveler linkage | Existing traveler owner; exact standalone-service selection UX still under review | IN PROGRESS |
| Customer/supplier/agent pickers | Current standalone UI still exposes raw IDs in places; replace with canonical owner-backed selectors where public APIs permit | IN PROGRESS |
| Files/documents | Platform Core owner; integration parity under review | IN PROGRESS |
| Refund/advances/collections/payments | Must remain Billing/Treasury/finance orchestration; exact available flows under review | IN PROGRESS |
| Service 360 profitability/accounting drill-down | Must compose existing financial read models, not duplicate financial fields; under review | IN PROGRESS |

## Implementation Commits / Checkpoints

- `f0deef4` — initial mission/ownership checkpoint on isolated branch.
- `b8b7a56` — added opt-in GitHub-hosted verification workflow.
- `01bea2f` — exposed canonical standalone-service revision terms needed for draft editing in the web client types.
- `f9e5a35` — added tourism draft editing plus service search/filter/sort using existing `updateDraft` API.
- `678df06` — enriched supplier list lifecycle/contact UX with filters/sorting/loading states/WhatsApp/phone while retaining safe lifecycle behavior.

No commit above was made to `main`. No Railway/production deployment was performed.

## Hosted Verification Workflow

Created: `.github/workflows/procurement-tourism-hosted-verify.yml`

Rules implemented:

- runner: `ubuntu-latest`;
- separate workflow; original CI unchanged;
- push events create **no verification job** unless the head commit message contains `[ci]`;
- manual `workflow_dispatch` is supported;
- commands are change-safety, engineering-integrity, Prisma generate, lint, TypeScript, architecture check, tests and build.

**The comprehensive workflow has NOT been run yet.** This is intentional because Phase 1 is not complete.

## Phase 1 — Implementation

**Status: IN PROGRESS**

Next work must continue from here without redoing completed items:

1. Finish literal OLD supplier documents/party controls and OLD tourism forms/workflows inventory.
2. Close supplier financial/document drill-down gaps only through Billing/Treasury/Platform Core public read models/APIs.
3. Review purchase return capability and add/extend only its canonical owner if genuinely absent.
4. Replace remaining raw party IDs in tourism daily UX with canonical customer/supplier/agent/traveler selectors where supported.
5. Complete standalone service document/attachment and accounting/profitability 360 composition without duplicating truth.
6. Audit tourism programs/bookings/itineraries/contract-inventory against legacy controls field-by-field.
7. Add only genuinely missing backend behavior to its canonical owner; no duplicate implementation.
8. Keep updating this checkpoint and meaningful commits.

Do not start comprehensive test execution yet.

## Phase 2 — Comprehensive Testing

**Status: NOT STARTED**

Start automatically only after both requested Phase 1 scopes are implementation-complete. Then run the hosted workflow/manual verification and additional migration/API/permissions/scoping/read-model/financial-owner/approval/route/form/action/filter/tab/workflow/safe-delete/document/financial-flow checks. Fix every discovered problem, then perform final literal OLD-vs-NEW page/button/icon/form/field/filter/action/menu/workflow/state audit.

Never claim a test passed unless it was actually run.

## Completion Rule

When Phase 2 and the final literal audit are complete, stop changes on this mission. Do not start a third module, do not merge to `main`, and do not deploy.
