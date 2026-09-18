# Accounting Build Sequence

Phase labels are future plans only. AC-02 has not started. “Canonical” means the rule/scenario is first implemented or activated in that phase. Later phases may perform only the explicitly listed integration acceptance or regression.

| Phase | Scope / primary capability | Prerequisites | Explicit exclusions | Canonical Business Rules | Canonical Golden Scenarios |
|---|---|---|---|---|---|
| AC-02 | Shared contract/kernel foundations: money, identifiers, context, audit envelope, boundary-test harness | approved AC-01 | no accounting business rule, financial table, posting, or scenario activation | none | none |
| AC-03 | Currency/FX, Cost Center and required reference kernels | AC-02 | no journal posting, invoice, settlement or close execution | BR-036, BR-042 | none |
| AC-04 | Period enforcement plus GL accounts, immutable journal, opening and fiscal close/reopen engine | AC-03 | no invoice or treasury workflow | BR-001–BR-006, BR-024, BR-038, BR-039 | GS-022 |
| AC-05 | Approval/control decisions, integrity and reconciliation framework, server enforcement | AC-04 | no broad auto-fix and no source-record mutation by Controls | BR-030, BR-031, BR-037, BR-072–BR-075 | GS-021, GS-040 |
| AC-06 | Billing, AR/AP, adjustments, advances and invoice tax snapshots | AC-04–AC-05 | no treasury voucher or bank workflow | BR-007–BR-009, BR-012–BR-018, BR-020–BR-022 | GS-001, GS-002, GS-009, GS-019 |
| AC-07 | Treasury instruments plus Billing-owned allocation integration, cheques, bank reconciliation and settlement FX | AC-06 | no direct bank API/feed | BR-010, BR-011, BR-025–BR-029 | GS-003–GS-008, GS-020 |
| AC-08 | Party netting, expenses, commissions, prepayments, deferrals and accruals | AC-06–AC-07 | no tourism orchestration | BR-019, BR-032–BR-035, BR-040, BR-041 | GS-010–GS-014 |
| AC-09 | Assets, loans, provisions, doubtful debts, payroll accounting and budgets | AC-04–AC-08 | HR/payroll calculation engine excluded | BR-023 | GS-015–GS-018 |
| AC-10 | Supplier commitments and PO lifecycle/reopening | AC-05–AC-07 and Cost Center kernel | no contract-capacity engine | BR-055, BR-067, BR-069–BR-071 | GS-029–GS-031 |
| AC-11 | Contract inventory, capacity, reservation/versioning and internal-first fulfillment | AC-10 | no booking billing/cancellation orchestration | BR-052, BR-056–BR-065 | GS-032–GS-039 |
| AC-12 | Tourism/Hajj/Umrah financial orchestration, milestone actualization and aggregate cancellation | AC-06–AC-11 | no redesign of Tourism operational domain; durable outbox remains open | BR-043–BR-051, BR-053, BR-054, BR-066, BR-068 | GS-023–GS-028 |
| AC-13 | Reporting and cross-module financial integration acceptance | AC-04–AC-12 | no new source balance and no rule reimplementation | none — integration/regression only | none — regression only |
| AC-14 | Migration/cutover/equivalence after separate approval | all implementation phases | unresolved statutory, bank and consolidation features | none — migration/regression only | none — replay all 40 as REGRESSION ONLY |

## Later integration acceptance only

These checks do not move canonical ownership or reimplement rules:

| Integration phase | Rules integrated/accepted |
|---|---|
| AC-04 | BR-036 |
| AC-06 | BR-004 |
| AC-07 | BR-012–BR-014 |
| AC-08 | BR-018, BR-030, BR-031 |
| AC-10 | BR-020 |
| AC-12 | BR-021, BR-037, BR-042, BR-052, BR-055, BR-056–BR-065, BR-067, BR-069–BR-071 |
| AC-13 | BR-072–BR-075 |

## Consistency policy

- The canonical rule sets above partition BR-001..BR-075 exactly once.
- The canonical scenario sets above partition GS-001..GS-040 exactly once.
- ACCOUNTING-AC00-COVERAGE-MATRIX.md is authoritative per item and uses the same canonical phase assignments.
- AC-13 reruns relevant cross-module tests as REGRESSION ONLY. AC-14 replays all 40 scenarios as REGRESSION ONLY.
- GL is not first: shared contracts, money/reference semantics, FX and cost-center identifiers precede posting. Period enforcement is activated with GL so BR-002 has one canonical phase.
