# CRM Legacy Parity — Execution Checkpoint

## Mission

Rebuild the complete **المبيعات والعملاء CRM** capability in the new system using the legacy repository only as a functional/UI reference, while preserving the new repository as the architectural source of truth.

Branch: `feature/crm-full-legacy-parity`

## Non-negotiable architecture rules

1. No legacy copy/paste.
2. No duplicate business owners or duplicate financial truth.
3. Party identity remains in `party-registry`.
4. Customer/Agent role and lifecycle remain in their canonical management modules.
5. Customer/Agent invoices, receivables, advances and credit limits remain in `billing-subledgers`.
6. Cash/bank settlement remains in `treasury-settlement`.
7. Agent commissions remain in `expense-commission-recognition` and are never implicitly netted against Agent receivables.
8. Documents use `platform-core` file storage/entity links.
9. Cross-module reads/actions use public application boundaries/read models.
10. `main` was not modified and Railway was not deployed from this workstream.

## Phase 1 — COMPLETE

Implemented and rebuilt on the new architecture:

- CRM navigation and dashboard.
- Customers list/KPIs/search/filtering and Customer 360.
- Customer identity/contact/commercial fields through canonical owners.
- Customer invoice, receipt, service launch and advance-refund actions.
- Customer documents with safe-delete retention references.
- Agents list/KPIs and Agent 360.
- Agent invoices, receipts, overpayment advances and advance refunds through Billing/Treasury.
- Agent receivable/overdue positions kept separate from commission liabilities.
- Agent commission claims/read/pay flow through the commission owner.
- Leads pipeline, lifecycle, selectors, conversion, WhatsApp and quotation actions.
- Follow-ups: due/overdue, complete, next follow-up, reschedule, cancel and history.
- Quotations: customer/lead selectors, multiple lines, revisions, approvals, accept/reject, Billing conversion, print/PDF/WhatsApp/share evidence.
- CRM dashboard attention for pipeline, quotations, customer receivables, agent receivables and commissions.
- Customer/Agent documents through generic Platform Core entity-file linkage.
- Superseded duplicate CRM page implementations removed from active source/routing.
- Billing canonical contracts extended to preserve `AGENT` identity correctly.
- Financial Reporting extended with `AGENT_RECEIVABLE` and `AGENT_ADVANCE` so Agent positions cannot leak into Customer aging.

## Phase 2 — COMPLETE

Root-cause static audit and comprehensive verification are complete.

Verified areas:

- Change Safety.
- Engineering Integrity.
- Prisma Client generation.
- Lint.
- TypeScript/typecheck across the workspace.
- Architecture rules and module boundaries.
- Unit/integration test suite executed by `pnpm verify`.
- CRM financial orchestration and owner boundaries.
- Customer/Agent document ownership and safe-delete retention behavior.
- Customer/Agent/Lead/Follow-up/Quotation/Dashboard/360 route and UI wiring.
- Permission/company/branch scope static review.
- AGENT Billing/Treasury/Reporting widened-contract fallout reviewed and corrected.
- Treasury composition test aligned with the canonical `PartyCashMovementApplicationService` export.
- Temporary hosted-runner smoke workflow passed and was removed before final verification.

## Final GitHub-hosted verification evidence

Final verified commit before workflow cleanup:

`cc1069a43090c221264b4b2ec749ecfc3bf2ddc0`

GitHub Actions run:

`36538280343` — `CRM Hosted Verify`

Result: **SUCCESS / GREEN**

Successful job steps included:

- Set up job
- Checkout
- pnpm setup
- Node setup
- Install dependencies
- Resolve main baseline
- Full verification (`pnpm verify`)
- Post-run cleanup

The final hosted verification completed successfully on 2026-09-29.

## Final parity review

Legacy functionality was used only as the functional/UI reference. The final active CRM surface preserves the useful legacy capabilities for:

- navigation and CRM dashboard,
- customers and Customer 360,
- agents and Agent 360,
- Leads and Follow-ups,
- quotations,
- financial customer/agent actions,
- documents,
- lifecycle/safe delete,
- search/filter/KPI/action menus,
- tourism-service entry linkage,
- owner-backed accounting integration.

No separate CRM ledger, invoice store, treasury store, commission store or duplicate party identity implementation was introduced.

## CI state after completion

`.github/workflows/crm-hosted-verify.yml` has been restored to **manual-only `workflow_dispatch`** on the feature branch. Normal commits no longer trigger the hosted CRM verification automatically.

## Final status

**CRM Phase 1: COMPLETE**

**CRM Phase 2: COMPLETE**

**Final comprehensive verification: GREEN**

**CRM workstream: CLOSED**

Do not continue modifying this CRM branch unless a new explicit CRM requirement or defect is raised. Do not start another business department from this checkpoint.
