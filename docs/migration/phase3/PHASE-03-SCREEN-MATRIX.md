# PHASE 3 — SCREEN / INTERACTION MATRIX

This matrix is the execution coverage contract for Phase 3. It is derived from the 00–08 migration scope files supplied by the product owner.

A route is not complete because it exists. The actual presentation and interaction surface must be reviewed.

---

## 00 — Global Shell / Login / Home

Review only; Phase 1 is already implemented.

Required visible surfaces:
- Boot / loading / auth shell.
- Login, password show/hide and recovery where supported by target contract.
- First-run/setup: administrator initialization, company data, visible startup steps, any backup/restore step visible during setup.
- App Shell.
- Full right Sidebar: brand/company block, navigation container, user block, account actions, version/license area.
- Full Topbar: page title, subtitle, global search, back, scroll-to-top/up, home, shortcuts, notifications, control shortcut, user menu.
- Global search results dropdown.
- Notifications dropdown.
- User dropdown.
- Global modal/dialog shell and footer actions.
- Global toast/confirmation pattern.
- Print Preview shell and visible Print/PDF/WhatsApp controls.
- Portal Home cards.
- Workspace landing shell.
- Mobile drawer / responsive shell.
- RTL shell behavior.

Workspace labels/order to preserve from old UI where applicable:
1. الحج والعمرة
2. المبيعات والعملاء CRM
3. الخدمات السياحية
4. المشتريات والموردون
5. المحاسبة والمالية
6. التقارير والرقابة
7. الإدارة والإعدادات

Legacy source areas used to prepare this contract:
- `index.html`
- `src/ui/ui.ts`
- `src/ui/navigation.ts`
- `src/ui/pages.ts`
- `src/commercial/pages.ts`
- `src/commercial/ux.ts`

---

## 01 — Sales / CRM / Customers

Primary visible pages/routes:
- CRM leads/follow-up surface (`crm` / current CRM equivalents).
- Customers.
- Agents.
- Quotations.
- Customer/Agent Party 360 and unified party surfaces reachable from the lists.

### CRM / Leads

Must review/rebuild:
- KPI/filter cards.
- Leads table.
- Search and sort.
- `+ عميل محتمل`.
- Follow-up action.
- Edit.
- Convert to customer.
- Delete when allowed.
- Lead form with all old visible fields and stage options.
- Follow-up form with type, result and next follow-up.
- Conditional actions by status.

### Customers

Must review/rebuild:
- KPI/filter cards: total / active / due / suspended.
- Table: customer / phone / balance / status / action.
- `+ عميل`.
- Customer form including basic and advanced fields from old UI.
- Open profile / more / 360.
- Edit.
- WhatsApp.
- Documents.
- Suspend/reactivate.
- Safe delete by state.
- Statement.
- Any old visible daily action.
- Party 360 tabs/cards/counts/recent activity/document groups/attachments.
- Unified party panel when reachable from the old flow.

### Agents

Must review/rebuild:
- List/filter/status/balance/commissions.
- `+ مندوب`.
- Agent form.
- Commission rules and payout UI.
- All visible commission modals/actions.
- Agent Party 360.

### Quotations

Must review/rebuild:
- KPI/filter cards.
- Table: quotation / customer / value / validity / status / action.
- `+ عرض سعر`.
- Line builder.
- Send.
- Accept.
- Convert to invoice.
- Print.
- Edit/delete according to state.
- Expired/draft/sent/accepted/history states.

Legacy source map:
- `src/ui/clean-pages.ts`
- `src/ui/forms.ts`
- `src/ui/forms-definitions.ts`
- `src/crm/crm.ts`
- `src/crm/party360.ts`
- `src/crm/unified-party.ts`
- `src/ui/actions.ts`

Boundary: financial actions opened from customer/agent screens must call the shared finance owner, not copy finance pages into CRM.

---

## 02 — Tourism Services

Primary visible page:
- Tourism services list/detail/create/edit cycle.

Must review/rebuild:
- Service list.
- KPI/filter/status cards.
- Search/sort.
- Old table columns.
- `خدمة جديدة`.
- Edit when state allows.
- Confirm / complete / cancel / reverse / print and other state-dependent row actions.
- Service Type management modal.
- New/edit tourism service form with dynamic fields.

Service type behavior must cover old visible types:
- Visa.
- Flight.
- Hotel.
- Transport.
- Trip.
- Any old custom service type surfaced by the reference.

Execution source selection:
- Automatic.
- Company contract/inventory.
- External purchase.

Form coverage:
- Optional contract/inventory.
- Customer.
- Supplier.
- Agent.
- Customer/agent receivable due.
- Sale price.
- Sale currency.
- Sale tax.
- Due date.
- External purchase cost.
- Cost currency.
- Purchase tax.
- Cost center.
- Commission.
- Reference.
- Operational details.
- Dynamic flight/hotel/transport/visa/trip fields.
- Warning/info/locked state once financially posted/staged.

Legacy source map:
- `src/ui/pages.ts` — services.
- `src/ui/forms.ts` — service form/dynamic fields.
- `src/integrated/service-inventory.ts`.
- `src/ui/actions.ts`.
- `src/ui/clean-pages.ts` where relevant.

Boundary: do not duplicate Hajj/Umrah inventory/contracts inside Tourism Services; consume the target contract where linkage exists.

---

## 03 — Procurement / Suppliers

Primary visible pages:
- Suppliers.
- Purchase Orders.
- Supplier Party 360 and supplier surfaces reachable from list.

### Suppliers

Must review/rebuild:
- KPI/filter cards: all / active / due / suspended.
- Table: supplier / phone / balance / status / action.
- `+ مورد`.
- Supplier invoice shortcut where old UI shows it; it must open the shared finance flow.
- Supplier form fields:
  - name
  - type
  - contact person
  - phone
  - WhatsApp
  - email
  - tax number
  - transaction currency
  - credit days
  - bank
  - account number
  - IBAN
  - address
  - notes
  - required/advanced behavior
- Supplier Party 360:
  - edit
  - WhatsApp
  - documents
  - suspend/reactivate
  - safe delete
  - statement
  - purchase orders
  - supplier invoices
  - payment vouchers
  - Hajj/Umrah linked contracts/commitments if visible in old UI

### Purchase Orders

Must review/rebuild:
- KPI/filter cards and status filters.
- Table: purchase order / supplier / value / executed vs required / status / action.
- `+ أمر شراء`.
- Form:
  - date
  - supplier
  - currency
  - expected supply date
  - optional Umrah program linkage
  - supplier reference
  - notes
  - line builder: description / quantity / price / tax / delete line
- State actions:
  - edit
  - approve
  - register execution/receipt
  - partial completion
  - convert executed quantity to supplier invoice
  - print
  - delete/cancel where allowed
- States: draft / approved / partial / received / invoiced / history.

Legacy source map:
- `src/ui/clean-pages.ts`
- `src/ui/forms.ts` — purchase order commercial doc.
- `src/ui/forms-definitions.ts` — supplier.
- `src/crm/party360.ts`.
- `src/crm/purchase-order-fulfillment.ts`.
- `src/ui/actions.ts`.

Known blocker: optional Umrah-program linkage stays blocked if current target purchase-order contract still lacks `programId`.

---

## 04 — Hajj & Umrah

Treat the entire workspace as one coherent old-UI presentation over current target contracts.

### A — Programs / Sales / Bookings / Travelers

Legacy-visible route set to cover:
- dashboard
- new program wizard
- new booking wizard
- resume booking flow
- seasons
- programs
- program workspace / Program 360
- costing
- bookings
- travelers

#### Dashboard
- Header and Core/branch status.
- KPI cards: open programs, bookings in progress, temporary/held bookings, problems.
- Four guided actions: create program, create booking, resume booking, prepare/operate trip.
- Current work plan.
- Nearest travel programs.
- Alerts.

#### Program wizard
- Step-by-step progress and navigation.
- Hajj/Umrah type.
- Season.
- Dates.
- Route/segments.
- Suppliers/services.
- Capacities.
- Prices.
- Cost.
- Margin.
- Sale-open rules.
- Hajj-specific conditional requirements.

#### Booking wizard / resume
- Customer.
- Program.
- Adult/child/infant counts.
- Rooms.
- Price/discount.
- Hold/confirmation state.
- Source/agent.
- Deposit.
- Payment method.
- Treasury.
- Traveler names.
- Readiness hints.
- Resume flow must identify missing requirements and navigate to the needed action.

#### Seasons
- List/columns/status/add/edit/delete according to permission.

#### Programs / Program 360
- Cards/tabs/KPIs/statuses/actions.
- Capacity/occupancy/availability.
- Cost/pricing/profitability/break-even where permitted.
- Navigation to bookings/travelers/contracts/operations.

#### Bookings
- List/filters/states/actions.
- Cancel/confirm/resume/collect/readiness according to old visible flow.

#### Travelers
- Traveler profile.
- Passport data and expiry.
- Visa.
- Room/allocation.
- Readiness/status.
- Edit/actions.

#### Costing
- Program costing UI.
- Respect target permission for cost visibility.
- Do not copy legacy calculation engine.

Legacy source map:
- `src/core/umrah/ui-pages.ts`
- `src/core/umrah/program-wizard.ts`
- `src/core/umrah/program-wizard-view.ts`
- `src/core/umrah/guided.ts`
- `src/core/umrah/forms.ts`
- `src/core/umrah/booking-rooms.ts`
- `src/core/umrah/insights.ts`
- `src/core/umrah/workflow.ts`
- `src/core/suites.ts`

### B — Contracts / Inventory / Operations / Readiness

Legacy-visible route set:
- contracts
- procurement
- visas
- hotels
- flights
- transport
- Hajj services
- trip readiness
- control
- trip operations
- incidents
- documents/reports
- Hajj/Umrah settings

#### Contracts / inventory
- Overview/KPIs/warnings.
- Tabs: overview / contracts / live inventory / program allocations / dues & procurement.
- Filter by contract type.
- Hotel contract.
- Flight block.
- Transport contract.
- Visa agreement.
- Contracted service.
- Details/allocation/edit/addendum/confirm/release/cutoff/availability indicators.
- Type-specific forms.

#### Procurement inside Hajj/Umrah
- Supplier commitments/procurement presentation.
- Link to central purchase-order owner; do not duplicate procurement backend.

#### Visas
- Batches/items/status/actions/print where visible.

#### Hotels
- Rooming/inventory/allocation/room assignment/actions.

#### Flights
- Flight blocks/tickets/assignments/status/actions.

#### Transport
- Contracts/vehicles/bus runs/manifests/assignments/actions.

#### Hajj services
- Camp/Mashaer/permits/Nusuk and other old visible Hajj-specific service forms/statuses.

#### Trip readiness / control
- Readiness cards/checks/blockers/action links.
- Pricing/operation panels visible in the old UI.

#### Trip operations
- Segment timeline.
- Tasks: overdue/critical/done/reopen.
- `+ مهمة تشغيل`.

#### Incidents
- Table/severity/status.
- Register incident.
- Close/delete where permitted.

#### Documents/reports
Per-program cards/outputs including old visible items such as:
- agent program summary
- traveler list
- room distribution
- accommodation voucher
- flight report
- grouping/departure list
- transport order
- supplier dues
- visa list
- trip program
- Hajj services
- program attachments
- central links to documents/invoices/receipts/purchase orders

#### Hajj/Umrah settings
- hold hours
- warning hours
- passport validity months
- base currency link
- default margin
- financial clearance requirement
- max due
- save

Legacy source map:
- `src/core/umrah/contracts.ts`
- `src/core/umrah/contracts-management.ts`
- `src/core/umrah/contracts-inventory.ts`
- `src/core/umrah/forms-contracts.ts`
- `src/core/umrah/procurement.ts`
- `src/core/umrah/operations.ts`
- `src/core/umrah/operations-execution.ts`
- `src/core/umrah/actions-print.ts`
- `src/core/umrah/forms.ts`
- `src/core/umrah/workflow.ts`

---

## 05 — Finance / Accounting

Do not force all old accounting routes into one generic workspace presentation merely because the target API owner is shared. Independent route-owned presentation is allowed and expected where the old UI had independent pages.

### A — Documents / Collection / Payment / Expense / Settlement / Accrual

Routes/screens:
- invoices
- receipts
- payments
- expenses
- settlements
- accruals

#### Invoices
- Customer/Supplier tabs/type split as visible in old UI.
- KPIs/filters/statuses/table/actions.
- Customer invoice and supplier invoice.
- Form fields:
  - date
  - party
  - currency
  - due date
  - execution/recognition date
  - supplier invoice number for supplier invoice
  - Draft/Posted save mode
  - payment terms
  - line builder: description / quantity / price / discount type / discount / tax / account / cost center / remove line
- Post/print/edit/credit-debit adjustment/void/reverse according to state.
- Global print preview/PDF/share shell.

#### Receipts
- List/filters/states/columns.
- Fields: date, party, treasury/bank, amount, currency, invoice, payment method, operation/cheque reference, bank, value date, counter account, description.
- Print/void/reverse by state.

#### Payments
- Same precision as receipts with supplier/other party, supplier invoice, payment methods and cheque behavior.

#### Expenses
- KPIs/filters/table.
- Category management.
- `+ مصروف`.
- Draft/Post/Edit/Delete/Reverse/Print.
- Fields: date, save mode, category, expense account, treatment, amount before tax, tax, currency, treasury, supplier, prepaid allocation months, cost center, due, payment method, reference, bank, value date, description.

#### Settlements
Old visible flows:
- supplier cancellation settlement
- customer balance write-off/settlement
- customer cancellation fee from advance
- doubtful debt provision
- debt write-off against provision
- list/history/reversal controls

#### Accruals
- invoice revenue deferral
- supplier invoice cost deferral
- accrued revenue
- payroll run
- recognition/allocation schedules
- pending/recognized/reversed states/actions

Legacy source map:
- `src/ui/clean-pages.ts`
- `src/ui/forms.ts`
- `src/ui/forms-definitions.ts`
- `src/accounting/invoices.ts`
- `src/accounting/advanced-pages.ts`
- `src/accounting/advanced.ts`
- `src/accounting/expense-categories.ts`
- `src/ui/actions.ts`

### B — Treasury / Banks / Cheques / FX / Taxes / Periods

Routes/screens:
- cheques
- treasury
- currencies
- taxes
- periods
- financial side of period archiving

#### Treasury
Old tabs:
- accounts
- transfers
- bank reconciliation

Must cover:
- balance cards.
- accounts table: account / type / currency / balance / status / action.
- `+ خزنة/بنك`.
- statement.
- edit/activate/deactivate.
- Transfers: `+ تحويل`, list, print, reverse.
- Bank reconciliation: import statement, match, system balance, statement balance, difference, status.
- Treasury form: name, type, currency, opening balance, custodian, bank, account number, IBAN, branch, low-balance alert.
- transfer/cash count/bank statement/bank reconcile forms if supported by target contract.

#### Cheques
- incoming/outgoing cheques.
- collection/payment/bounce/cancel states.
- old filters/tables/actions/forms.

#### Currencies
- currencies and exchange rates.
- add/edit/activate/deactivate if supported.
- code, name, symbol, decimals, rate source, rate date, rate.
- FX revaluation presentation where old UI exposes it.

#### Taxes
- tax-code list.
- add/edit.
- code, name, rate, use, input account, output account.

#### Periods
- fiscal years / financial periods.
- open / close / reopen / lock / archive according to target permissions/contracts.
- confirmations/status tables.

Legacy source map:
- `src/ui/clean-pages.ts`
- `src/ui/pages.ts`
- `src/ui/forms-definitions.ts`
- `src/accounting/currency-periods.ts`
- `src/accounting/advanced-pages.ts`
- `src/ui/actions.ts`

### C — Ledger / Journal / Accounts / Trial / Cost Centers / Assets / Loans / Budgets

Routes/screens:
- journal
- accounts
- trial
- cost centers
- assets
- loans
- budgets

#### Journal
- list/states/actions.
- multi-line journal form.
- date, description, Draft/Post, recurrence, first recurrence date.
- line builder: account, debit, credit, currency, cost center, remove line.
- edit/post/reverse/print by state.

#### Accounts
- chart of accounts/tree/table.
- add/edit.
- code, name, description, type, classification, nature, parent account.
- protected/system account UI states.
- opening balance form: date, account, nature, amount, currency, party for control accounts, cost center.

#### Trial balance
- filters/date/currency/table/totals/print/export.

#### Cost Centers
- list/tree/columns.
- add/edit.
- name, parent, estimated budget, owner, description.

#### Assets
- asset list/status/depreciation/actions.
- add asset fields: name, acquisition date, cost, salvage, life months, currency, asset account, accumulated depreciation, depreciation expense, acquisition method, supplier, treasury/bank, cost center.
- depreciation run/disposal/reversal/detail presentation if supported.

#### Loans
- lender/date/principal/rate/months/first due/currency/treasury.
- provision/schedule/actions visible in old UI.

#### Budgets
- year/month/account/cost center/value.
- actual-vs-budget presentation and cards/tables/actions.

Legacy source map:
- `src/ui/pages.ts`
- `src/ui/forms.ts`
- `src/ui/forms-definitions.ts`
- `src/accounting/advanced-pages.ts`
- `src/accounting/advanced.ts`
- `src/accounting/engine.ts` only as a UI behavior reference; do not copy accounting logic.
- `src/ui/actions.ts`

---

## 06 — Reports / Control

Routes/screens:
- workcenter
- owner
- reports
- approvals
- audit
- activity

### Work Center
- KPI/action cards.
- Tasks and alerts.
- Priority ordering.
- Direct open/drill-down to record.
- Expand/collapse old behavior.

### Owner / Executive Dashboard
- Executive KPIs/charts/cards/lists/filters that exist in the old UI.
- Permission-sensitive cost visibility.

### Reports
Old report grouping/search presentation must cover at least:

Financial statements:
- income statement
- balance sheet
- cash flow
- general ledger
- journals

Customers/Suppliers:
- transaction detail
- customer aging
- supplier aging
- sales by customer
- sales by agent
- supplier costs

Treasury/Tax:
- receipts
- payments
- daily treasury movement
- tax summary
- tax detail

Hajj/Umrah:
- travelers
- bookings
- program occupancy
- program profitability
- passport expiry
- visa status

Management/Analysis:
- service profitability
- commissions
- expenses
- FX differences
- FX exposure

Also review:
- report range/filter modal
- table/result presentation
- print/export/PDF controls

Unsupported definitions remain visible but blocked if no target reporting contract exists; do not calculate them in React.

### Approvals
- pending/approved/rejected presentation.
- decision/details/actions.

### Audit
- financial control issues/warnings.
- severity.
- links/actions.
- health/status presentation.

### Activity
- period/filter controls.
- table with user/action/record/time/details.

Legacy source map:
- `src/ui/work-center.ts`
- `src/ui/pages.ts`
- `src/ui/clean-pages.ts`
- `src/finance/insights.ts`
- `src/reports/printing.ts`
- `src/ui/actions.ts`

---

## 07 — Administration / Settings

Routes/screens:
- market readiness
- backup center
- period archiving administrative surface
- quick guide
- users
- branches
- documents
- sessions
- data exchange
- support
- settings

### Users & Permissions
- users table/actions.
- new/edit user.
- employee name.
- username.
- password where appropriate to target flow.
- role.
- branch.
- old visible payment approval limit / max discount / cost visibility controls must not create a parallel user model; connect to current owners or record target exception.
- activate/deactivate.
- reset password.
- permission matrix: view/add/edit/cancel-or-reverse/delete/approve/print/export per module where old UI exposes it.

### Branches
- list/add/edit/activate/deactivate/access permissions when visible.

### Documents Center
- archive/attachments.
- categories/groups/search/filter/list/cards.
- add attachment: record type, record id, description, expiry date, file.
- preview/download/delete/expiry states.
- If target contract lacks metadata/workflow, preserve visible structure but keep unsupported persistence blocked.

### Sessions & Devices
- connected sessions/devices.
- terminate session/action/status.

### Data Exchange
- Excel/CSV import/export.
- type selection.
- file selection.
- mapping.
- result/error summary.

### Support / System Status
- diagnostic/status cards.
- connection.
- license/version.
- support/notes/logs where present in old UI.

### Backup Center
Old UI shows create/verify/restore/server/local backup list/status/actions/confirmations. Current target restrictions must remain; do not bypass Owner/MFA security.

### Smart Period Archiving
- close/archive/data health/restore-or-review actions and confirmations as visible.
- financial close ownership remains Accounting.

### Quick Guide / Market Readiness
- cards/checklist/links/progress/actions.

### Settings
Old tabs/cards/fields include:
- company identity/data.
- accounts/policies/finance links.
- numbering/prefixes.
- appearance/printing: system color, appearance, font family, font sizes 13–18px, font preview, A4/A5, orientation, animations, amount in words, signatures, footer.
- alerts: passport, invoice due, program proximity, treasury low balance, activity log retention.
- data protection/backup link.
- visible license state and support links, without copying legacy license logic.
- danger/reset area only through real target security owner.
- workspace order/visibility if target UI supports it.

Legacy source map:
- `src/ui/navigation.ts`
- `src/ui/pages.ts`
- `src/commercial/pages.ts`
- `src/commercial/actions.ts`
- `src/commercial/data-exchange.ts`
- `src/commercial/product.ts`
- `src/documents/attachments-backup.ts`
- `src/documents/output-center.ts`
- `src/ui/actions.ts`
- `src/ui/forms-definitions.ts`

---

## 08 — Final Visual Reconciliation

After implementing all sections:

- compare Navigation / Portal / Sidebar / Topbar / Modals.
- walk every workspace and route above.
- maintain a private `Legacy visible element -> New element` coverage matrix.
- fix every missing/mismatch/duplicate/overlay.
- remove stale target pages, V2 routes, dead route-owned components, stale CSS, dead imports and duplicate nav entries created obsolete by the final replacement.
- keep shared components that remain in use.
- review RTL/responsive/tables/forms/menus/dialogs/loading/empty/error/print shell.
- every visible action must call a real target contract or remain documented as `BLOCKED-BY-BACKEND`.
- do not create a giant reconciliation CSS layer; fix the owning component.

Final acceptance must report checked/matched/missing/duplicate-leftover/blocked counts and full quality-gate results.