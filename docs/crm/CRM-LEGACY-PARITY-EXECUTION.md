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
| Customer/agent invoices, receivables, advances and credit limits | `billing-subledgers` |
| Cash/bank receipt/payment settlement | `treasury-settlement` |
| Threshold approval evidence and decisions | `financial-controls` |
| Financial agent commission claims and payments | `expense-commission-recognition` |
| Binary file storage and entity-file links | `platform-core` |
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
- Total, active, receivable attention, overdue invoices, due-commission attention, suspended.
- Name, phone, WhatsApp, fixed/percent commercial default commission, currency, notes.
- Legacy actions: receipt from agent, invoice on agent, advance refund, due commission settlement when applicable.
- Edit, WhatsApp, documents, lifecycle, safe delete and Agent 360.
- Agent receivables must remain separate from commission liabilities; no implicit netting.

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

## Phase 1 status — COMPLETE

- [x] Dedicated branch created from current `main`.
- [x] CRM navigation group renamed/aligned to `المبيعات والعملاء CRM` and visible `المندوبون` terminology.
- [x] Customer workspace rebuilt using canonical Party + Customer ownership.
- [x] Customer form exposes person/company, legal name, identity/contact/address fields supported by Party Registry.
- [x] Assigned agent uses an active-agent picker rather than raw ID input.
- [x] Customer KPI/list read model includes receivable and overdue attention from Billing without CRM-owned balance truth.
- [x] Customer invoice and receipt actions execute through canonical Accounting/Billing/Treasury APIs with the customer Party preselected.
- [x] Customer advance refund is owner-backed: Treasury posts outgoing cash, Billing consumes exact available advance, Financial Controls creates/validates threshold approval evidence, retries use stable source identities, and Treasury is compensated automatically if the Billing leg fails.
- [x] Tourism service action uses a customer-aware launcher that creates the service in the canonical Tourism Services owner.
- [x] Customer 360 expanded to summary, full Billing finance, operations, activity/account view and owner-backed documents.
- [x] Generic Platform Core entity-file ownership implemented for CRM documents; Customer and Agent upload/download/delete use the same platform owner and register retention references so Safe Delete cannot bypass attached documents.
- [x] Agent workspace rebuilt with WhatsApp, lifecycle, documents, safe delete, receivable/overdue attention and accounting-owner commission attention.
- [x] Billing canonical contracts support `AGENT` invoice/party kind and shared Billing mapping classifies Agent positions as Agent-owned rather than Customer-owned.
- [x] Agent invoice, receipt, overpayment advance and advance refund are implemented through Billing/Treasury owner boundaries without CRM financial tables.
- [x] Agent receivables are visible in list/Agent360/dashboard separately from commission claims; commission liabilities remain owned by `expense-commission-recognition` and are never implicitly netted against agent receivables.
- [x] Agent 360 expanded with assigned customers, referred leads, quotations, receivable invoices/overdues, documents, canonical commission claims, and direct owner-backed commission payment.
- [x] Leads workspace rebuilt with canonical party fields, responsibility/referral selectors, lifecycle actions, loss reason, history, WhatsApp, quotation and conversion actions.
- [x] Follow-up workspace rebuilt with lead/user selectors, due/overdue queues, completion, chained next follow-up, reschedule, cancel, correction and history.
- [x] Quotations rebuilt with customer/lead selectors, prefill, multiple lines, revisions, approvals, reject/accept, Billing conversion, print/PDF/WhatsApp/share and evidence history.
- [x] CRM dashboard expanded with pipeline, quotations, customer receivables/overdues, agent receivables/overdues and agent commissions by currency.
- [x] Superseded duplicate Customer/Agent/Lead/Follow-up/Agent360 UI implementations removed from active routing/source surfaces.
- [x] Phase 1 implementation marker complete. No change was made to `main`; no Railway deployment is part of this branch workflow.

## Phase 2 status — STARTED

Run one comprehensive pass and fix every discovered defect before marking complete:

- [ ] Build and TypeScript/typecheck.
- [x] Change-safety / engineering-integrity checks reached and passed on GitHub-hosted verification.
- [ ] Unit tests for touched canonical owners.
- [ ] API/integration tests for Customer/Agent financial orchestration, compensation, approvals and documents.
- [ ] UI route/form/action coverage for Customers, Agents, Leads, Follow-ups, Quotations, Dashboard and both 360 workspaces.
- [ ] Permission/branch/company isolation checks.
- [x] Prisma client generation succeeded on GitHub-hosted verification; migration validation still remains.
- [ ] Safe-delete/reference-retention checks for Customer/Agent documents and cross-module links.
- [ ] Final legacy-vs-new button/icon/filter/action/workflow parity review.
- [ ] Fix all failures and record final Phase 2 completion marker.

## Root-cause sweep before this verification

Instead of triggering another run after each small failure, the branch was reviewed by failure class first:

- Public Nest controller responses now have explicit portable return contracts rather than leaking inferred branded/private types.
- Billing CRM receivable currency output and Commission read output now have explicit public return types.
- Generic Accounting explicitly rejects Agent receivable settlement and leaves Agent settlement with the CRM Billing/Treasury orchestration boundary.
- Platform entity-file persistence was moved out of the application service into an infrastructure repository boundary; raw SQL writes no longer live in application code.
- Customer and Agent document upload controls now use the canonical shared `Input` primitive instead of raw HTML inputs, satisfying the UI architecture rule.
- Change-safety manifest now includes the required Accounting compatibility edit and Platform file-repository files.
- Earlier Engineering Integrity and Lint failures were fixed without `any`, lint suppression or duplicate implementation.

This `[ci]` commit intentionally runs the next full hosted verification only after that static/root-cause sweep.

The hourly continuation service must continue from this checklist. It must stay on `feature/crm-full-legacy-parity`, never modify `main`, never deploy Railway, and stop without starting another business section after Phase 2 is complete.