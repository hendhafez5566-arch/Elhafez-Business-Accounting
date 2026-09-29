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
- `scripts/umrah-ui-parity-smoke.mjs`;
- focused `src/core/umrah/forms.ts` contract/picker sections;
- latest OLD commit history including the PartyTransactions enhancement, which confirms legacy expectations for linked invoice/payment/PO transaction drill-down while preserving original-currency evidence.

Important OLD behaviors retained as requirements, not copied as code:

- Supplier “More/360” concepts: edit, phone/WhatsApp, documents, suspend/reactivate, guarded deletion, account/transaction-linked drill downs.
- Supplier history must be preserved while lifecycle changes stop new operations.
- Supplier procurement history includes POs, supplier commitments, contract links and payment/invoice document access.
- Procurement commitment/cancellation must respect downstream invoice/receipt/execution evidence.
- Tourism/Umrah UI historically exposed grouped workspaces for contracts/inventory, programs, bookings, travelers, visas, flights, transport, costing/procurement, operations, documents/control/settings.
- Program/service flows use guarded lifecycle transitions rather than deleting financial history.
- OLD contract forms used supplier selection (with quick-create convenience), hotel room inventory/rates plus date overrides, hotel cancellation policy, flight outbound/return legs, seat cost/currency/ticket deadline/fare class/baggage, and contract attachment actions.
- OLD picker UX constrained program selection by lifecycle/sales state and surfaced contextual availability; these are UX requirements to compare against canonical NEW read models, not legacy data-model requirements.

Still queued for literal legacy extraction:

- remaining focused OLD Umrah `forms.ts`, `ui-pages.ts`, `operations.ts`, `workflow.ts` sections;
- supplier/party browser smoke references;
- Umrah workflow smoke references;
- remaining old buttons/menus/fields/states used by the two requested scopes.

## NEW Evidence Reviewed

Confirmed existing implementations that must be reused rather than rebuilt:

### Supplier / Procurement

- `supplier-management` owns supplier identity linkage, lifecycle, approval, categories, credit days, contact/notes, bank accounts, holds/history.
- `SupplierIntelligenceReadModelService` composes Supplier 360 only through public owners. It now includes supplier profile, evaluation/dispute history, procurement metrics, branch-scoped PO history, and a separate permission-protected financial read model.
- Supplier financial drill-down now reads Billing-owned supplier invoices/open positions and Treasury-owned vouchers, plus active Billing advances referenced by Treasury. No supplier balance/invoice/payment truth is stored in supplier modules or UI.
- The financial endpoint is separate from general Supplier 360 and requires the existing `accountingFinanceRead` permission; lack of accounting permission does not block non-financial Supplier 360.
- `procurement-sourcing` already implements PR → submit → approval/rejection → RFQ → supplier invitation → bids → deterministic quote comparison → award → PO creation through the canonical procurement owner.
- `procurement-pages.tsx` implements PO create/edit/approve/cancel, receipt evidence, receipt corrections, received-quantity-to-supplier-invoice conversion through Billing, and direct purchases through the accounting owner.
- Purchase returns now have a dedicated NEW UI workspace but still use the existing `procurement-fulfillment` correction API. No return table/service was created. An uninvoiced physical return lowers received quantity through immutable correction evidence; invoiced quantity must be handled in Billing before received quantity can be reduced below invoiced quantity.

### Tourism / Services

- `standalone-services` is the canonical standalone tourism-service owner.
- Backend already had optimistic-revision `updateDraft`; migration work exposed it in the tourism UI.
- Canonical customer/agent/traveler/supplier selectors now replace raw party-ID entry in the standalone tourism service workspace where public owner APIs exist.
- Traveler selection maps through `traveler-management`; customer/agent/supplier selections use their canonical Party identities instead of duplicating identity data.
- `tourism-services` workspace already uses service fulfillment, immutable vouchers, supply planning, supplier confirmation, delivery evidence, cancellation orchestration and durable finance integration.
- Routes already separate standalone services, tourism programs, bookings, itineraries and contract inventory instead of creating a legacy monolith.
- Contract Inventory now reads suppliers from the canonical Supplier Management endpoint and programs from the canonical Tourism Programs endpoint; the UI filters supplier choices to active/approved suppliers and program choices away from closed/cancelled states. No supplier/program identity is duplicated in the inventory owner.
- Contract Inventory already keeps contract versions, hotel/flight/transport/visa capacity, availability, allocation/release, stop-sale and corrective/amendment behavior under the canonical tourism-contract-inventory owner. Literal parity still requires deciding which OLD commercial fields belong in contract terms/version metadata versus other canonical owners before adding anything.

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
| Supplier 360 | Extended existing read model/page with PO history + permission-separated finance drill-down; documents still pending | IN PROGRESS |
| Supplier evaluation | Existing `supplier-evaluation` | REUSE |
| Supplier disputes | Existing `supplier-disputes` | REUSE |
| PR/RFQ/bids/comparison/award | Existing `procurement-sourcing` | REUSE |
| PO/commitment | Existing `procurement-finance` exposed through procurement operations | REUSE |
| Receiving/corrections | Existing `procurement-fulfillment` | REUSE |
| Supplier invoice conversion | Existing Billing-owned flow from received PO quantity | REUSE |
| Direct purchase | Existing Billing-backed flow | REUSE |
| Supplier payable/balance/invoice history | Billing public read API composed in Supplier 360, exact branch scoped | DONE |
| Supplier payment/refund/voucher history | Treasury public read API composed in Supplier 360, exact branch scoped | DONE |
| Supplier active advances | Billing owner read via Treasury-linked advance IDs; no duplicate advance store | DONE |
| Shared attachments/documents | Must reuse Platform Core; literal UI parity still under review | IN PROGRESS |
| Purchase returns | Dedicated UI over existing immutable fulfillment correction; Billing-first guard for invoiced quantity | DONE |

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
| Contract supplier/program pickers | Canonical Supplier Management/Tourism Programs reads wired into Contract Inventory UI | DONE |
| OLD hotel/flight commercial contract fields | Map field-by-field to canonical version terms/inventory/finance owners before implementation; do not duplicate cost/financial truth | IN PROGRESS |
| Traveler linkage | Canonical traveler selector wired into standalone-service UX | DONE for standalone service; other legacy workspaces still auditing |
| Customer/supplier/agent pickers | Canonical owner-backed selectors replace raw IDs in standalone-service daily UX | DONE for standalone service; other workspaces still auditing |
| Files/documents | Platform Core owner; integration parity under review | IN PROGRESS |
| Refund/advances/collections/payments | Must remain Billing/Treasury/finance orchestration; exact available flows under review | IN PROGRESS |
| Service 360 profitability/accounting drill-down | Must compose existing financial read models, not duplicate financial fields; under review | IN PROGRESS |

## Implementation Commits / Checkpoints

- `f0deef4` — initial mission/ownership checkpoint on isolated branch.
- `b8b7a56` — added opt-in GitHub-hosted verification workflow.
- `01bea2f` — exposed canonical standalone-service revision terms needed for draft editing in the web client types.
- `f9e5a35` — added tourism draft editing plus service search/filter/sort using existing `updateDraft` API.
- `678df06` — enriched supplier list lifecycle/contact UX with filters/sorting/loading states/WhatsApp/phone while retaining safe lifecycle behavior.
- `73cfd8b` / `d75aea2` — replaced raw tourism customer/agent/traveler/supplier ID entry with canonical owner-backed selectors.
- `1dfc715` — extended Supplier Intelligence read model with PO history and owner-backed financial composition.
- `de77adf` — wired Billing/Treasury public services into Supplier Intelligence at the composition root.
- `68c4975` — added accounting-read permission boundary for Supplier financial 360 endpoint.
- `00596be` — aligned supplier read-model sanity coverage with the new owner integrations (not executed yet in Phase 1).
- `e7e65c3` — added Supplier 360 purchase history, invoices/outstanding, payment/receipt vouchers, active advances, permission-aware finance state and loading state to the NEW UI.
- `57f3829` — added a purchase-return workspace backed exclusively by immutable fulfillment corrections with precise decimal quantity validation.
- `0c0b01a` — exposed the purchase-return workspace in the existing Purchases & Suppliers navigation.
- `cf505cc` — exposed canonical Supplier Management and Tourism Programs reads in the Contract Inventory web client.
- `6e0e068` — wired active/approved supplier and open-program selectors into Contract Inventory, replacing raw daily-use IDs without changing ownership.
- Current checkpoint — literal OLD contract-form audit captured hotel/flight commercial fields and attachment actions; no speculative owner/model changes were made.

No commit above was made to `main`. No Railway/production deployment was performed.

## Hosted Verification Workflow

Created: `.github/workflows/procurement-tourism-hosted-verify.yml`

Rules implemented:

- runner: `ubuntu-latest`;
- separate workflow; original CI unchanged;
- push events create **no verification job** unless the head commit message contains `[ci]`;
- manual `workflow_dispatch` is supported;
- commands are change-safety, engineering-integrity, Prisma generate, lint, TypeScript, architecture check, tests and build.

**The comprehensive workflow has NOT been run yet.** This remains intentional because Phase 1 is incomplete.

## Phase 1 — Implementation

**Status: IN PROGRESS**

Continue from here without redoing completed items:

1. Finish literal OLD supplier documents/party controls and remaining OLD tourism forms/workflows inventory.
2. Wire supplier/shared documents only through the existing Platform Core file owner.
3. Complete standalone service document/attachment and accounting/profitability 360 composition without duplicating truth.
4. Continue tourism programs/bookings/itineraries/contract-inventory audit field-by-field. For hotel/flight contract fields already extracted, first map commercial terms to the contract-version owner and route any financial truth to Billing/Accounting/Treasury rather than adding parallel fields.
5. Review tourism refund/advance/collection/payment actions through existing Billing/Treasury/orchestration owners.
6. Add only genuinely missing backend behavior to its canonical owner; no duplicate implementation.
7. Keep updating this checkpoint and meaningful commits.

Do not start comprehensive test execution yet.

## Phase 2 — Comprehensive Testing

**Status: NOT STARTED**

Start automatically only after both requested Phase 1 scopes are implementation-complete. Then run the hosted workflow/manual verification and additional migration/API/permissions/scoping/read-model/financial-owner/approval/route/form/action/filter/tab/workflow/safe-delete/document/financial-flow checks. Fix every discovered problem, then perform final literal OLD-vs-NEW page/button/icon/form/field/filter/action/menu/workflow/state audit.

Never claim a test passed unless it was actually run.

## Completion Rule

When Phase 2 and the final literal audit are complete, stop changes on this mission. Do not start a third module, do not merge to `main`, and do not deploy.
