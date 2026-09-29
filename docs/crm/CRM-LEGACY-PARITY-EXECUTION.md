# CRM Legacy Parity — Execution Checkpoint

## Mission

Rebuild the complete **المبيعات والعملاء CRM** capability in the new system using the legacy repository only as a functional/UI reference. The new repository remains the architectural source of truth.

Branch: `feature/crm-full-legacy-parity`

## Non-negotiable rules

1. Never copy legacy implementation code into the new system.
2. Never create a second owner for existing business truth.
3. Never add CRM-owned receivable, invoice, advance, credit-limit, settlement, passport or accounting truth when an owner already exists.
4. Cross-module composition must use public application boundaries/read models.
5. Existing duplicate-resolution, lifecycle, permissions and safe-delete behavior must be preserved.
6. Do not modify `main` and do not deploy to Railway from this workstream.
7. Phase 1 is implementation. Phase 2 is the single comprehensive test/parity pass requested by the owner.

## Canonical ownership

| Concern | Canonical owner |
| --- | --- |
| Person/organization identity, phone, WhatsApp, email, address, national/tax identity | `party-registry` |
| Customer role, number, lifecycle, assigned agent, commercial notes | `customer-management` |
| Agent role, number, lifecycle, commercial commission defaults | `agent-management` |
| Leads | `crm-leads` |
| Follow-ups | `crm-followups` |
| Quotations and quotation communication evidence | `quotations` |
| Travelers/passports/travel-document history | `traveler-management` |
| Customer/agent invoices, receivables, advances and credit limits | `billing-subledgers` when supported by its canonical contract |
| Cash/bank receipt/payment settlement | `treasury-settlement` |
| Financial agent commission claims and payments | `expense-commission-recognition` |
| Customer/Agent 360 and CRM dashboard | composition/read model only; no duplicate tables |

## Legacy surface to preserve/rebuild

### CRM navigation
- Dashboard / CRM landing area.
- العملاء المحتملون والمتابعة.
- العملاء.
- المندوبون.
- عروض الأسعار.
- Follow-up workspace.
- Traveler linkage where it is a real travel-domain concern.

### Customers
- KPI/filter cards: total, active, receivable attention, suspended.
- Search by number/name/phone/email/tax/national identity where supported by canonical owner.
- Person/company type.
- Name/legal name, phone, WhatsApp, email, address, national/tax identity.
- Assigned agent picker (never raw ID entry).
- Commercial notes.
- Legacy `الإجراءات`: receipt, sales invoice, new service, advance refund when applicable.
- Legacy `المزيد`: edit, WhatsApp, documents, suspend/reactivate, safe delete.
- Customer 360: summary, finance, operations, attachments/activity, unified account view using owner reads.

### Agents / Representatives
- Total, active, due-commission attention, suspended.
- Name, phone, WhatsApp, fixed/percent commercial default commission, currency, notes.
- Legacy actions: receipt from agent, invoice on agent, advance refund, due commission settlement when applicable.
- Edit, WhatsApp, lifecycle, safe delete and Agent 360.

### Leads / Follow-ups
- Full lead pipeline and lifecycle.
- Source/service/value/currency/responsibility.
- Contacted/qualified/quoted/won/lost/reopen transitions.
- Scheduling, due/overdue, complete/reschedule/cancel and history.
- Replace raw IDs in UI with owner-backed selectors/search surfaces.

### Quotations
- Customer/lead selector, not raw IDs.
- Lines, discount/manual override, revisions, approval, send, accept/reject, conversion.
- Print/PDF/WhatsApp/share and communication history.
- Prefill from customer/lead action menu.

### Dashboard / 360
- Expand existing `CrmSalesReadModelService`; do not create a second CRM truth store.
- Add only read composition needed for legacy parity.
- Keep financial amounts currency-separated.

## Phase 1 status

- [x] Dedicated branch created from current `main`.
- [x] CRM navigation group renamed/aligned to `المبيعات والعملاء CRM` and visible `المندوبون` terminology.
- [x] Customer workspace rebuilt using canonical Party + Customer ownership.
- [x] Customer form exposes person/company, legal name, identity/contact/address fields supported by Party Registry.
- [x] Assigned agent uses an active-agent picker rather than raw ID input.
- [x] Customer KPI/list read model includes receivable and overdue attention from Billing without CRM-owned balance truth.
- [x] Customer invoice and receipt actions execute through the canonical Accounting/Billing/Treasury APIs with the customer Party preselected.
- [x] Tourism service action uses a customer-aware launcher that creates the service in the canonical Tourism Services owner.
- [x] Customer 360 expanded to summary, full Billing finance, operations, activity shell, and comprehensive account view.
- [x] Agent workspace rebuilt with WhatsApp, lifecycle, safe delete, and accounting-owner commission attention.
- [x] Agent 360 expanded with assigned customers, referred leads, quotations, canonical commission claims, and direct owner-backed commission payment.
- [x] Leads workspace rebuilt with canonical party fields, responsibility/referral selectors, lifecycle actions, loss reason, history, WhatsApp, quotation and conversion actions.
- [x] Follow-up workspace rebuilt with lead/user selectors, due/overdue queues, completion, chained next follow-up, reschedule, cancel, correction and history.
- [x] Quotations rebuilt with customer/lead selectors, prefill, multiple lines, revisions, approvals, reject/accept, Billing conversion, print/PDF/WhatsApp/share and evidence history.
- [x] CRM dashboard expanded with pipeline, quotation, customer receivable/overdue and agent commission attention by currency.
- [x] Superseded duplicate Customer/Agent/Lead/Follow-up/Agent360 UI implementations removed from active routing/source surfaces.
- [x] Generic attachment/document ownership gap closed by architectural decision: the current platform contains attachment IDs and legacy `file-metadata` migration evidence, but no canonical binary document owner/public API. CRM must not invent a private attachment store. Customer/Agent 360 therefore keeps activity/owner-backed evidence only; generic document upload remains disabled until a platform-wide document owner is introduced outside this parity workstream.
- [ ] Complete atomic customer advance-refund workflow across Billing + Treasury, then enable `رد مقدم` as a real owner-backed action.
  - Checkpoint: the existing supplier-refund orchestration was reviewed as a reference for failure-safe ownership. Customer refund must not be routed through ECR because ECR owns supplier/expense/commission workflows, not customer liabilities. Billing must remain owner of advance availability and Treasury owner of the outgoing cash movement.
- [ ] Resolve canonical Agent receivable/invoice/advance ownership. Billing now has canonical `AGENT` invoice/party types and Treasury voucher domain now admits `AGENT`; remaining application contracts, settlement behavior, tests/API/UI actions must be completed before enabling agent receipt/invoice/advance buttons.
- [ ] Complete Phase 1 implementation marker only after the two remaining financial ownership gaps above are resolved or explicitly closed by an architectural decision.

## Phase 2 status

Not started by design. Start only after Phase 1 is fully implemented, then run one comprehensive build/typecheck/unit/integration/API/UI/permission/migration/parity pass and fix all discovered defects.
