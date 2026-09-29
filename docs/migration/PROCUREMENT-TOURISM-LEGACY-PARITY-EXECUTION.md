# Procurement + Tourism Legacy Parity Execution

## Mission

Rebuild the functional/UI/UX coverage of the legacy `hendhafez5566-arch/Elhafez-Tourism-Offline` procurement/supplier and tourism/service areas inside `hendhafez5566-arch/Elhafez-Business-Accounting` without importing legacy architecture or copying legacy code.

**Legacy system = functional/UI/UX reference only.**  
**New system = architectural source of truth.**

Working branch: `feature/procurement-tourism-full-legacy-parity`

Guardrails:
- Never modify or merge `main` as part of this mission.
- Never deploy to Railway or production.
- Never add a second implementation where a canonical owner already exists.
- Never persist accounting truth in UI, supplier, or tourism feature state when an accounting owner exists.
- Never use direct cross-module database access.
- Never create duplicate party identities, invoice/payment/balance tables, attachment systems, permission systems, or repositories.
- All cross-module work uses public application services, public module APIs, read models, or an orchestration layer.
- Sensitive/financial actions must be backend permission checked, scope checked (company/branch), and approval-policy aware.
- Existing linked entities are not hard-deleted unsafely; lifecycle, suspend/reactivate, references, audit evidence, and retention are preserved.
- Existing migrations are immutable. Any database change must use a new migration.

## Canonical Ownership

| Concern | Canonical owner in NEW | Rule |
|---|---|---|
| Supplier identity/contact | Party Registry + Supplier Management | Reuse/extend only |
| Supplier operational lifecycle/profile | Supplier Management | Reuse/extend only |
| Supplier qualifications/categories/bank details/holds/history | Supplier Management | Reuse/extend only |
| Supplier invoices/payables/advances | Billing / Accounting owner | Supplier UI orchestrates; no duplicated financial truth |
| Supplier payments/refunds/settlement | Treasury | Reuse Treasury APIs/read models |
| Supplier evaluation | Supplier Evaluation | Reuse/extend |
| Supplier disputes | Supplier Disputes | Reuse/extend |
| Procurement sourcing/RFQ/quotes | Procurement Sourcing | Reuse/extend |
| Purchase orders / procurement fulfillment | Procurement Fulfillment (+ Finance where applicable) | Reuse/extend |
| Tourism service | Tourism Services | Reuse/extend |
| Tourism booking/program/itinerary/inventory | Existing tourism booking/program/itinerary/contract-inventory owners | Reuse/extend |
| Service supplier execution | Service Fulfillment | Reuse/extend |
| Voucher | Service Vouchers | Reuse/extend |
| Traveler/passport | Traveler Management | Reuse/extend |
| Customer identity | Customer Management / Party Registry | Reuse/extend |
| Files/attachments | Existing Platform/Core file owner | Reuse; no duplicate attachment store |
| GL | General Ledger | Reuse |
| Cash/bank | Treasury | Reuse |
| Tax | Tax owner | Reuse |
| Approvals | Financial Controls / existing approval owner | Reuse |
| Currency/FX | Currency FX | Reuse |
| Commission | Commission owner | Reuse |

## Architecture Decisions Recorded So Far

1. NEW already contains a `supplier-management` module and supplier-facing web UI. It is the canonical supplier operational owner; no replacement supplier module will be created.
2. Supplier Management already integrates through public services with Platform Core and Party Registry. Cross-module identity will stay there rather than being copied into procurement/tourism tables.
3. Supplier Management owns operational supplier data/lifecycle concerns (including existing category/qualification/bank/hold/history concepts) but does **not** become the source of truth for invoices or payments.
4. NEW already contains a tourism-services workspace plus existing fulfillment/voucher/finance integrations. Tourism parity will extend these owners rather than introducing a parallel legacy-style Umrah/service subsystem.
5. Legacy `src/core/umrah/procurement.ts` is treated as behavioral evidence only. Its global/event-bridge persistence model will not be copied. The reusable business semantics identified so far are: commitment creation from supplier-backed contracts/costs, safe cancellation when downstream invoice/receipt/execution evidence exists, program/booking/cost cascade cancellation rules, and per-traveler actualization policies.

## Rolling Legacy Inventory -> NEW Mapping

Status legend: `DISCOVERED`, `GAP-REVIEW`, `IMPLEMENTING`, `DONE`, `EXCLUDED`.

### A. Suppliers / Procurement

| Legacy feature / UX capability | NEW canonical owner | Current assessment | Action | Intended implementation location | Status |
|---|---|---|---|---|---|
| Supplier list/search/filter/sort/status/actions | Supplier Management + existing supplier web page | Exists; parity depth still under literal review | Reuse/Extend | supplier-management + supplier-pages | GAP-REVIEW |
| Add/edit supplier | Supplier Management + Party Registry | Exists; field/action parity under review | Reuse/Extend | supplier-management public application service + supplier UI | GAP-REVIEW |
| Supplier identity/contact | Party Registry | Exists | Reuse | Party Registry public API/read model | DISCOVERED |
| Supplier classification/status | Supplier Management | Existing concepts confirmed | Reuse/Extend | supplier-management | GAP-REVIEW |
| Payment terms / credit terms | Supplier Management for operational preference; accounting owner for financial truth | Needs owner-level parity review | Extend only if missing | supplier-management + billing/accounting public API | GAP-REVIEW |
| Supplier balances / dues / financial account | Billing/Accounting read model | Must not be duplicated in supplier state | Reuse/Orchestrate | billing/accounting read model consumed by supplier 360 | GAP-REVIEW |
| Supplier bank accounts | Supplier Management | Existing concept confirmed | Reuse/Extend | supplier-management | DISCOVERED |
| Supplier documents / attachments | Platform/Core file owner | Existing shared attachment system to be identified | Reuse | public file owner API | GAP-REVIEW |
| WhatsApp / phone actions | Supplier UI + party contact data | UX parity review pending | Extend UI using existing identity/contact | supplier pages | GAP-REVIEW |
| Suspend/reactivate/holds | Supplier Management | Existing hold/lifecycle concepts confirmed | Reuse/Extend | supplier-management | GAP-REVIEW |
| Safe delete / archive | Supplier Management lifecycle + reference checks | Must be safe; no unsafe hard delete | Extend | supplier-management + public reference checks | GAP-REVIEW |
| Supplier 360 | Supplier Management orchestration/read model | Existing surrounding read models to review | Extend/Rebuild in NEW style | supplier read model + UI | GAP-REVIEW |
| Supplier rating/evaluation | Supplier Evaluation | Module expected/needs exact coverage review | Reuse/Extend | supplier-evaluation | GAP-REVIEW |
| Supplier history/activity/audit | Supplier Management + platform audit | Existing history concept confirmed | Reuse/Extend | supplier-management + audit | GAP-REVIEW |
| Supplier disputes/issues | Supplier Disputes | Module expected/needs exact coverage review | Reuse/Extend | supplier-disputes | GAP-REVIEW |
| Supplier offers / RFQ | Procurement Sourcing | Existing owner expected/needs exact coverage review | Reuse/Extend | procurement-sourcing | GAP-REVIEW |
| Quote comparison | Procurement Sourcing | Coverage pending | Reuse/Extend | procurement-sourcing + procurement UI | GAP-REVIEW |
| Supplier approval | Supplier Management / Financial Controls depending action | Existing approval framework must be reused | Reuse/Extend | public approval APIs | GAP-REVIEW |
| Purchase requests / supply requests | Procurement Sourcing/Fulfillment | Coverage pending | Reuse/Extend | procurement-* | GAP-REVIEW |
| Purchase orders (PO) | Procurement Fulfillment / Finance | Existing owner expected | Reuse/Extend | procurement-fulfillment | GAP-REVIEW |
| Receiving / delivery / fulfillment | Procurement Fulfillment | Coverage pending | Reuse/Extend | procurement-fulfillment | GAP-REVIEW |
| Purchase returns | Procurement Fulfillment + Accounting | Coverage pending | Reuse/Extend | fulfillment orchestration + accounting | GAP-REVIEW |
| Supplier invoices | Billing/Accounting | Never duplicate in supplier module | Reuse/Orchestrate | billing owner | GAP-REVIEW |
| Supplier payments/checks/payment methods | Treasury | Never duplicate in supplier module | Reuse/Orchestrate | treasury | GAP-REVIEW |
| Supplier advances / advance refund | Accounting/Billing + Treasury | Never duplicate financial truth | Reuse/Orchestrate | billing/treasury public APIs | GAP-REVIEW |
| Notes | Existing notes/activity owner or supplier operational profile | Coverage pending | Reuse/Extend | canonical shared/supplier owner | GAP-REVIEW |
| KPI cards | Read models over canonical owners | Existing UI parity pending | Extend | supplier/procurement UI read models | GAP-REVIEW |
| Empty/loading/error/confirmation states | NEW Design System | Parity pending | Extend | supplier/procurement pages | GAP-REVIEW |

### B. Tourism / Services

| Legacy feature / UX capability | NEW canonical owner | Current assessment | Action | Intended implementation location | Status |
|---|---|---|---|---|---|
| Tourism service list/search/filter/status/actions | Tourism Services | Existing page/workspace confirmed | Reuse/Extend | tourism-services page + public service API | GAP-REVIEW |
| Create/edit service | Tourism Services | Existing service owner confirmed | Reuse/Extend | tourism services application service/UI | GAP-REVIEW |
| Customer linkage | Customer Management / Party Registry | Must remain canonical | Reuse | public customer/party APIs | GAP-REVIEW |
| Supplier linkage | Supplier Management | Must remain canonical | Reuse | public supplier API/read model | GAP-REVIEW |
| Traveler/passport linkage | Traveler Management | Existing owner expected | Reuse/Extend | traveler-management | GAP-REVIEW |
| Representative/agent linkage | Existing party/employee/agent owner | Exact owner to confirm | Reuse/Extend | canonical owner public API | GAP-REVIEW |
| Service type/status/date/destination | Tourism Services | Existing coverage to inspect | Reuse/Extend | tourism-services | GAP-REVIEW |
| Service cost/sale price/profitability/currency | Tourism Services presentation + accounting/FX truth | Durable finance integration exists; no duplicate financial truth | Reuse/Extend | tourism service read model + finance/FX owner | GAP-REVIEW |
| Hotels/transport/flights/visas | Tourism Contracts/Inventory + Tourism Services/Bookings | Legacy supports these contract kinds | Reuse/Extend | existing tourism-* owners | GAP-REVIEW |
| Programs/trips/bookings/itineraries | Tourism Programs/Bookings/Itineraries | Existing owners expected | Reuse/Extend | tourism-* modules | GAP-REVIEW |
| Supplier fulfillment for service | Service Fulfillment | Existing integration confirmed | Reuse/Extend | service-fulfillment | DISCOVERED |
| Costs/expenses/revenue | Accounting/Billing read models | No duplicate tourism ledger truth | Reuse/Orchestrate | finance/billing public APIs | GAP-REVIEW |
| Customer advance/collection | Billing + Treasury | Must remain financial owner | Reuse/Orchestrate | billing/treasury | GAP-REVIEW |
| Supplier advance/payment | Billing + Treasury | Must remain financial owner | Reuse/Orchestrate | billing/treasury | GAP-REVIEW |
| Documents/files | Platform/Core file owner | Shared system to reuse | Reuse | public file API | GAP-REVIEW |
| Voucher | Service Vouchers | Existing integration confirmed | Reuse/Extend | service-vouchers | DISCOVERED |
| Confirmations | Tourism Services / Fulfillment | Exact coverage pending | Reuse/Extend | canonical service/fulfillment owner | GAP-REVIEW |
| Notes/activity/audit | Existing audit/activity infrastructure | Exact coverage pending | Reuse/Extend | platform audit/read model | GAP-REVIEW |
| Status lifecycle | Tourism Services + fulfillment/booking owners | Existing lifecycle pending literal comparison | Reuse/Extend | canonical service owner | GAP-REVIEW |
| Cancel/amend/refund | Tourism Services + Billing/Treasury | Legacy safe-cancel evidence noted; exact NEW flow pending | Extend without duplicate finance | orchestration across public APIs | GAP-REVIEW |
| Service 360 | Tourism Services read model/orchestration | Existing workspace confirmed; parity pending | Extend | tourism services UI/read model | GAP-REVIEW |
| Accounting linkage | Existing finance integration | Existing durable-finance integration confirmed | Reuse/Extend | finance orchestration/public APIs | DISCOVERED |
| KPIs/dashboard | Read models over canonical owners | Existing tourism workspace; parity pending | Extend | tourism UI/read models | GAP-REVIEW |
| Empty/loading/error/confirmation states | NEW Design System | Parity pending | Extend | tourism pages | GAP-REVIEW |

## Legacy Evidence Reviewed

- Recursive legacy repository tree.
- `src/core/umrah/procurement.ts` (behavioral reference only).
- Legacy areas queued for literal extraction: `src/commercial/*`, `src/crm/party360.ts`, supplier/customer smoke tests, `src/core/umrah/ui-pages.ts`, `forms.ts`, `operations.ts`, `workflow.ts`, and Umrah UI/workflow smoke tests.

## NEW Evidence Reviewed

- Recursive NEW repository tree.
- Existing `supplier-management` module and supplier web-page references.
- Existing supplier public API exports and module metadata.
- Existing tourism-services web/API references and integrations with Service Fulfillment, Service Vouchers, and finance-related orchestration.

## Implementation Progress

### Phase 1 — Implementation

**Status: IN PROGRESS**

Completed so far:
- Created isolated feature branch from current `main`.
- Established canonical ownership guardrails.
- Confirmed Supplier Management and Tourism Services are existing canonical owners and will be extended rather than replaced.
- Began literal legacy behavioral extraction and NEW module mapping.
- Created this durable checkpoint before feature code changes.

Next execution steps (continue without redoing completed work):
1. Finish literal OLD vs NEW inventory from supplier/commercial/party360 and Umrah UI/forms/workflow/smoke references.
2. Inspect exact NEW public APIs/models/controllers/pages for supplier, sourcing, fulfillment, evaluation, disputes, tourism, traveler, voucher, billing, treasury, files, permissions, scoping, approvals.
3. Implement backend gaps in canonical owners and orchestration.
4. Implement UI parity gaps using NEW design system; every action must be backend-backed.
5. Add only new migrations if genuinely required after owner review.
6. Add/update focused tests as implementation artifacts where needed, but defer comprehensive verification run until both sections are implementation-complete.
7. Update this checkpoint and commit each meaningful milestone.

### Phase 2 — Comprehensive Testing

**Status: NOT STARTED**

Starts automatically only after both Phase 1 sections are implementation-complete. It must include actual runs (not claims) for build, TypeScript, lint, architecture/change-safety/engineering-integrity checks, Prisma generate/migrations, unit/integration/API tests, permissions/scoping/read-model/financial-owner/approval checks, routes/forms/actions/filters/tabs/workflows, safe-delete/lifecycle/documents/financial flows, followed by a literal final legacy-vs-new audit.

## Hosted Verification Workflow

Required file: `.github/workflows/procurement-tourism-hosted-verify.yml`

Constraints:
- GitHub-hosted `ubuntu-latest` only.
- Full verification triggers only by `workflow_dispatch` or commit message containing `[ci]`.
- Ordinary checkpoint/hourly commits must not consume full CI.
- Original CI is left unchanged unless strictly necessary.

## Completion Rule

When Phase 2 is marked complete with actual recorded results and the final literal legacy parity audit is complete, stop making changes. Do not begin any third module/section.
