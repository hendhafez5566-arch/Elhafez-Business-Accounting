# Accounting Module Map

Legend: dependencies name public contracts only; no dependency permits internal/table access.

## 1. General Ledger (GL)

- Responsibility/capabilities: accounts, posting, reversal, manual/recurring journal definitions, opening-balance posting, immutable accounting history.
- Owns: accounts, journals, journal lines, journal source uniqueness, posting/reversal references.
- Public services: validate account; post instruction; reverse journal; query journal/account activity.
- Emits: `JournalPosted`, `JournalReversed`.
- Consumes: period authorization, FX snapshot, approved source posting instructions.
- Must not own: invoices, allocations, treasury instruments, tax policy, periods, operational documents, report balances.
- Compile-time module imports: Period Control and Currency & FX public ports only. Cost-center and party IDs are opaque shared-contract references; GL does not import Cost or Party Accounting.

## 2. Period Control

- Responsibility/capabilities: fiscal years/periods, close/reopen workflow, blockers versus warnings, year-close instruction.
- Owns: fiscal years, periods, close checklists/results, close/reopen metadata.
- Public services: authorize posting date; begin/evaluate/complete close; reopen.
- Emits: `PeriodClosed`, `PeriodReopened`, `FiscalYearClosed`.
- Consumes: immutable close-readiness evidence, FX readiness and GL close-journal results supplied by the caller-owned close orchestrator through shared contracts/events. Period Control does not import Controls, FX or GL.
- Must not own/post journals or schedules.
- Compile-time module imports: none. The close orchestrator independently invokes Controls and Period public ports.

## 3. Currency & FX

- Responsibility: currencies, rates, rate snapshots, revaluation calculation and realized-FX calculation policy.
- Owns: currencies, FX rates, revaluation runs/details.
- Public services: resolve rate; compute settlement FX; prepare revaluation instruction.
- Emits: `FxRatePublished`, `FxRevaluationPrepared`.
- Consumes: no GL module service. An authorized caller/orchestrator submits the FX-produced posting instruction to GL and returns the immutable result/event.
- Must not own settlement allocations or journals.
- Compile-time module imports: none. Revaluation posting uses shared contracts plus caller-owned orchestration, not an FX → GL package dependency.

## 4. Tax

- Responsibility: tax codes/policy, immutable invoice tax snapshot, tax ledger projection and reconciliation inputs.
- Owns: tax codes, effective rules, tax snapshots/ledger facts.
- Public services: validate/snapshot tax; tax report facts.
- Emits: `TaxSnapshotCreated`, `TaxConfigurationChanged`.
- Consumes: posted/adjusted invoice facts; GL references.
- Must not own invoices or journal lines.
- Dependencies: none for command decisions; consumes events.

## 5. Billing & Subledgers

- Responsibility: customer/agent/supplier invoices, credit/debit adjustments, AR/AP, advances, credit limits, deferred flags, source uniqueness.
- Owns: invoices/lines, adjustments, receivables, payables, customer/supplier/agent advances, external supplier invoice uniqueness, subledger allocations view.
- Public services: create/post/void invoice; create/reverse adjustment; query exposure/outstanding/blockers; register/reverse allocation; consume/create advance.
- Emits: `InvoicePosted`, `InvoiceReversed`, `AdjustmentPosted`, `AdvanceCreated`, `ExposureChanged`.
- Consumes: settlement/netting allocations, tax snapshot, GL result, period authorization.
- Must not own cash vouchers, treasury, journals, procurement quantities, recognition schedules.
- Dependencies: Tax; FX; GL; Period Control; Financial Controls approval decisions.

## 6. Treasury & Settlement

- Responsibility: treasuries, receipts, payments, cheques, transfers, cash count, bank reconciliation, settlement/allocation execution and realized FX.
- Owns: treasuries, vouchers, cheques, transfers, cash counts, statement lines/matches, and immutable references/projections of Billing-owned allocations.
- Public services: receive/pay; request Billing allocation/reversal; transfer; clear cheque; reconcile bank; query collection/payment blockers.
- Emits: `ReceiptPosted`, `PaymentPosted`, `SettlementRequested`, `ChequeStatusChanged`. Billing emits allocation-applied/reversed events.
- Consumes: Billing outstanding/allocation services, FX calculation, approval decisions, GL results.
- Must not own invoices, AP/AR balances, economic allocation records/effects, bank-feed integration connector, or journals.
- Dependencies: Billing & Subledgers; FX; GL; Period Control; Financial Controls.

## 7. Party Accounting

- Responsibility: financial party-group links and formal, authorized, reversible netting across roles.
- Owns: accounting party-group links, netting documents and their allocation/posting references.
- Public services: query combined informational position; propose/approve/execute/reverse netting.
- Emits: `PartyNettingPosted`, `PartyNettingReversed`.
- Consumes: AR/AP outstanding and Billing allocation services, GL results, approvals.
- Must not merge role subledgers automatically or own party master data/invoices.
- Dependencies: Billing & Subledgers; GL; Financial Controls.

## 8. Expense, Commission & Recognition

- Responsibility: expenses, prepayments, agent commissions, deferred revenue/cost, accrued revenue and exact schedules.
- Owns: expenses; prepayment schedules; commission rules/claims; deferred/accrual schedules and parts.
- Public services: submit/approve/cancel expense or commission; build/post/reverse schedules; query cancellation blockers.
- Emits: `ExpenseApproved`, `CommissionApproved/Paid/Cancelled`, `RecognitionDue/Posted`.
- Consumes: approvals, invoice facts, treasury payment, GL posting.
- Must not own supplier invoices, payments, journals, booking lifecycle.
- Dependencies: Financial Controls; Billing; Treasury; GL; Period Control; FX.

## 9. Assets & Financing

- Responsibility: fixed assets, depreciation/disposal; loans and amortization; provisions and doubtful-debt allowances; payroll accounting runs.
- Owns: assets/depreciations, loans/schedules, provisions/allowances, payroll accounting runs.
- Public services: capitalize/depreciate/dispose; originate/pay loan; recognize/use provision; accrue/pay payroll.
- Emits: lifecycle and posting-result events.
- Consumes: approvals, Treasury funding, Billing supplier/customer references, GL results.
- Must not own employee HR/payroll calculation, invoices, cash, journals.
- Dependencies: Financial Controls; Treasury; Billing; GL; Period Control; FX.

## 10. Cost & Budget Accounting

- Responsibility: cost-center hierarchy, program linkage, budgets, actual-vs-budget and profitability query model.
- Owns: cost centers and budgets; program-to-cost-center association.
- Public services: ensure/validate cost center; authorize/check budget; query program accounting snapshot.
- Emits: `CostCenterCreated`, `BudgetThresholdReached`.
- Consumes: GL facts and operational source references.
- Must not own journal lines, program operations, invoice balances.
- Compile-time module imports: none. It consumes GL events through shared contracts and maintains a rebuildable actual-cost/profit projection; GL never imports Cost.

## 11. Procurement Finance

- Responsibility: supplier commitments, purchase orders, receipts/invoiced quantities, financial procurement references and reopening after invoice cancellation.
- Owns: supplier commitments, POs/lines, receipt quantities, invoiced quantities, source/reference history.
- Public services: create/cancel commitment; create/approve/receive/void PO; convert to invoice; reopen lifecycle; query blockers.
- Emits: `CommitmentCreated/Cancelled`, `POApproved/Received/Reopened`, `SupplierInvoiceRequested`.
- Consumes: supplier invoice outcome/reversal, approval, cost-center validation, operational actualization request.
- Must not own AP invoice, journal, contract inventory, supplier master.
- Dependencies: Billing; Financial Controls; Cost Accounting.

## 12. Tourism Contract Inventory

- Responsibility: hotel date-level, flight aggregate, transport overlap, visa quota/stop-sale, generic contract capacity; reservation/version/amendment and cost allocation.
- Owns: contracts, versions, schedules, capacity, reservations/releases, service inventory allocations and calculated allocation cost.
- Public services: availability; reserve/adjust/release; resolve internal-first fulfillment; query release blockers.
- Emits: `InventoryAllocated/Adjusted/Released`, `ExternalShortageIdentified`, `AllocationCostChanged`.
- Consumes: procurement/invoice history blocker facts.
- Must not own program, booking, supplier payable, PO, journal.
- Dependencies: Procurement Finance blocker query only.

## 13. Tourism / Hajj / Umrah Finance Orchestration

- Responsibility: financial orchestration for programs, bookings, services, milestones and cancellations; operational state remains in the external Tourism domain.
- Owns: integration workflow/correlation state and immutable financial references to operational aggregates; not the operational aggregates themselves.
- Public services: handle booking/service/program commands; calculate aggregate cancellation blockers; request program-cost actualization.
- Emits: source requests/events catalogued in Contracts Catalog.
- Consumes: invoice, treasury, commission, inventory, procurement, cost-center blocker/result contracts.
- Must not own invoices, allocations, contracts, PO, journals or operational Tourism source data.
- Dependencies: Cost Accounting; Inventory; Procurement; Billing; Treasury; Expense/Commission.

## 14. Financial Controls & Reconciliation

- Responsibility: approval policy/limits/no-self-approval, integrity checks, subledger/GL and tax/GL reconciliation, close/cancellation readiness, narrow supervised fixes.
- Owns: approval requests/decisions, policies, reconciliation runs/issues/evidence/resolutions.
- Public services: request/decide approval; evaluate integrity/close; reconcile; query blockers/warnings.
- Emits: `ApprovalDecided`, `IntegrityIssueDetected/Resolved`, `CloseReadinessEvaluated`.
- Consumes: immutable evidence supplied by caller-owned orchestration and rebuildable projections fed by shared-contract events. It does not synchronously import source-owner modules.
- Must not own or mutate source financial objects; fixes call owner public commands.
- Compile-time module imports: none. Source owners may import the Controls public decision port in the one allowed direction: owner → Controls.

## 15. Financial Reporting

- Responsibility: authorized projections, statements, ledgers, aging, program/supplier/treasury/tax reports and exports.
- Owns: rebuildable projections, report definitions/runs, no accounting source truth.
- Public services: report/query/export.
- Emits: none affecting accounting.
- Consumes: events/read models from all owners.
- Must not post, approve, allocate, or repair.
- Compile-time module imports: none required beyond shared contracts/projection infrastructure. All source consumption is event/projection based.
