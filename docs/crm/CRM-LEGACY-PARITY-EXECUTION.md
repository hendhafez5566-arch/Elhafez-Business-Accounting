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
- [x] New customer workspace started using canonical Party + Customer ownership.
- [x] Customer form now exposes person/company, legal name, identity/contact/address fields supported by Party Registry.
- [x] Assigned agent uses an active-agent picker rather than raw ID input.
- [x] Customer `الإجراءات` and `المزيد` surfaces introduced for legacy parity.
- [x] Agent workspace started with WhatsApp and legacy-style action/more surfaces.
- [ ] Wire accounting action intents to accounting workspace/orchestration without duplicate finance code.
- [ ] Wire tourism service action intent with customer preselection.
- [ ] Expand customer list/read model with receivable attention from canonical finance owner.
- [ ] Expand Customer 360 tabs and read composition.
- [ ] Expand Agent 360 including canonical financial commission attention if a financial owner/read exists.
- [ ] Rebuild Leads UI selectors and legacy workflow richness.
- [ ] Rebuild Follow-up UI selectors/history UX.
- [ ] Rebuild Quotations selectors/prefill and complete legacy action flow.
- [ ] Expand CRM dashboard.
- [ ] Remove superseded duplicate UI implementations from `crm-core-pages.tsx` after route migration is complete.
- [ ] Complete Phase 1 implementation marker.

## Phase 2 status

Not started by design. Start only after Phase 1 is fully implemented, then run one comprehensive build/typecheck/unit/integration/API/UI/permission/migration/parity pass and fix all discovered defects.
