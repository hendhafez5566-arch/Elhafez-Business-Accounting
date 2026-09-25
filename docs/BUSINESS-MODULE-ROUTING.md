# Business Module Routing for Coding Agents

Status: **MANDATORY PRE-EDIT ROUTING GUIDE**

Every coding agent must use this file together with `docs/BUSINESS-MODULE-ARCHITECTURE.md` before deciding where a requested business change belongs.

## 1. Routing procedure

Before editing:

1. Identify the requested **business truth**, not just the screen/menu name.
2. Find the matching row below.
3. If the owner is **EXISTING**, inspect and extend that owner. Do not create a parallel module.
4. If the owner is **PLANNED**, create that exact module from `modules/_template` only when the task explicitly authorizes implementing it.
5. If the request needs more than one owner, choose one primary orchestrating owner and call the others through public APIs/contracts/events.
6. Never use a suite/workspace as a code owner.
7. If no route matches, STOP and report `BLOCKED — OWNERSHIP DECISION REQUIRED`.

## 2. Common request routing

| User request / keywords | Canonical owner |
|---|---|
| موسم حج/عمرة, season | `hajj-umrah-seasons` |
| برنامج حج/عمرة, package/program lifecycle | `hajj-umrah-programs` |
| حجز حج/عمرة, hold/confirm/cancel booking | `hajj-umrah-bookings` |
| مسافر, passport, traveler profile | `traveler-management` |
| عقد فندق/طيران/نقل/تأشيرة, allotment, quota, capacity, inventory, stop-sale | `tourism-contract-inventory` |
| توزيع غرف, rooming list | `hajj-umrah-rooming` |
| تشغيل التأشيرات, visa batch/item | `hajj-umrah-visa-operations` |
| ticket issuance, manifest, ticket deadline | `hajj-umrah-ticketing` |
| bus run, transport assignment | `hajj-umrah-transport-operations` |
| تشغيل فوج, tasks, incidents | `hajj-umrah-trip-operations` |
| جاهزية حج/عمرة | `hajj-umrah-readiness` |
| باركود العمرة المصري, Egyptian Umrah barcode | `hajj-umrah-barcode` (PLANNED; current UI shell only until functional implementation is explicitly started) |
| برنامج/رحلة سياحة عامة | `tourism-programs` |
| حجز سياحة عامة | `tourism-bookings` |
| برنامج يومي / itinerary | `tourism-itineraries` |
| خدمة منفصلة فندق/طيران/تأشيرة/نقل | `standalone-services` |
| voucher | `service-vouchers` |
| supplier confirmation / service fulfillment | `service-fulfillment` |
| party/person/company common identity | `party-registry` |
| عميل customer profile | `customer-management` |
| مندوب / agent operational profile | `agent-management` |
| lead/opportunity | `crm-leads` |
| follow-up | `crm-followups` |
| quotation | `quotations` |
| مورد supplier operational profile/approval | `supplier-management` |
| purchase order / supplier commitment | **existing** `procurement-finance` |
| receiving / procurement execution | `procurement-fulfillment` |
| supplier evaluation | `supplier-evaluation` |
| supplier dispute | `supplier-disputes` |
| customer invoice / receivable / advance | **existing** `billing-subledgers` |
| supplier invoice / payable financial truth | **existing** `billing-subledgers` + `procurement-finance` according to existing contracts |
| receipt/payment/cash/bank/cheque | **existing** `treasury-settlement` |
| journal/COA/posting | **existing** `general-ledger` |
| tax | **existing** `tax` |
| currency / FX | **existing** `currency-fx` |
| cost center / budget | **existing** `cost-budget-accounting` |
| commission/expense/recognition/accrual | **existing** `expense-commission-recognition` |
| asset/loan/provision/payroll accounting | **existing** `assets-financing` |
| financial approval/reconciliation | **existing** `financial-controls` |
| financial reports | **existing** `financial-reporting` |
| tourism booking financial workflow | **existing** `tourism-finance-orchestration` |
| work center / actionable cross-module queue | `work-center` projection |
| operational reports | `operational-reporting` projection |
| users/roles/company/branch/session/audit/files/notifications/config | **existing** `platform-core` |
| SaaS plan/subscription/payment/company-code/tenant commercial access, platform-owner control plane | **existing** `saas-control-plane` |
| custom fields | `custom-fields` |
| numbering | `document-numbering` |
| import/export | `data-exchange` |
| backup/support jobs | `platform-operations` |

## 3. Ambiguous examples

### “Build Customers”

Default interpretation:
- common person/company identity -> `party-registry`;
- customer-specific operational profile -> `customer-management`;
- receivable/balance/invoices -> existing `billing-subledgers` / accounting public APIs;
- UI may combine all three, but it must not write all three tables from one repository.

### “Build Suppliers”

Default interpretation:
- common identity -> `party-registry`;
- supplier operational profile/approval -> `supplier-management`;
- PO/commitment -> existing `procurement-finance`;
- receiving/execution -> `procurement-fulfillment`;
- supplier payable/invoice -> accepted accounting owners.

### “Build Allotment”

Do **not** create a new module. Use/extend existing `tourism-contract-inventory`.
The UI may call it Allotment, Contracts, Stock, Inventory, or Capacity.

### “Build Hajj & Umrah”

Do **not** create one giant `hajj-umrah` module.
Determine which submodule owns each requested behavior and build phase-by-phase.

### “Build Management Dashboard”

The dashboard is composition/projection. It must consume public APIs/read models from owners and must not query arbitrary business tables as a shortcut.

## 4. Financial boundary rule

Operational modules may initiate financial requests but never reproduce financial state.

Examples:
- booking asks `tourism-finance-orchestration` to create/continue the financial workflow;
- supplier fulfillment references Procurement/Accounting IDs;
- agent module does not calculate/post accounting commission truth;
- customer module does not own receivable balance.

## 5. Final pre-edit statement

Before code changes, the agent should be able to state:

- Suite:
- Canonical owning module:
- Existing or planned:
- Owned data being changed:
- Public dependencies required:
- Modules explicitly not being modified:
- Tests proving the boundary:

If any of these cannot be determined from the architecture and current code, stop for an ownership decision instead of improvising.
