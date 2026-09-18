# AC-00 Coverage Matrix

Source: approved AC-00 catalogue. Every identifier appears exactly once. Canonical phases are implementation/activation ownership; optional later phases are integration acceptance only and never reimplementation.

## Business Rules — 75/75

| Rule | AC-00 rule | Owner module | Collaborating modules | Canonical implementation phase | Later integration acceptance phase |
|---|---|---|---|---|---|
| BR-001 | Every posted journal must balance in base currency | General Ledger | Period; FX; Controls | AC-04 | — |
| BR-002 | No posting into a closed period or year | Period Control | Controls; GL through orchestration/event | AC-04 | — |
| BR-003 | A journal line must have exactly one economic side | General Ledger | Period; FX; Controls | AC-04 | — |
| BR-004 | Control accounts require dimensional party identity | General Ledger | Period; FX; Controls | AC-04 | AC-06 |
| BR-005 | Historical master data is not freely mutable | General Ledger | Period; FX; Controls | AC-04 | — |
| BR-006 | Historical document numbers are immutable | General Ledger | Period; FX; Controls | AC-04 | — |
| BR-007 | Supplier invoice external number is unique per supplier | Billing & Subledgers | Tax; FX; GL; Period; Controls; Treasury | AC-06 | — |
| BR-008 | Customer credit limit is evaluated before invoice posting | Billing & Subledgers | Tax; FX; GL; Period; Controls; Treasury | AC-06 | — |
| BR-009 | Tax configuration is frozen into posted invoice lines | Billing & Subledgers | Tax; FX; GL; Period; Controls; Treasury | AC-06 | — |
| BR-010 | Payment allocation follows deterministic oldest-due ordering | Billing & Subledgers | Tax; FX; GL; Period; Controls; Treasury | AC-07 | — |
| BR-011 | Settlement in a different currency recognizes realized FX | Billing & Subledgers | Tax; FX; GL; Period; Controls; Treasury | AC-07 | — |
| BR-012 | Excess collection/payment becomes advance | Billing & Subledgers | Tax; FX; GL; Period; Controls; Treasury | AC-06 | AC-07 |
| BR-013 | A draft invoice may be pre-funded | Billing & Subledgers | Tax; FX; GL; Period; Controls; Treasury | AC-06 | AC-07 |
| BR-014 | Contract supplier advances are source-specific | Billing & Subledgers | Tax; FX; GL; Period; Controls; Treasury | AC-06 | AC-07 |
| BR-015 | Invoice cancellation is reversal, not erasure | Billing & Subledgers | Tax; FX; GL; Period; Controls; Treasury | AC-06 | — |
| BR-016 | Credit note may create an advance | Billing & Subledgers | Tax; FX; GL; Period; Controls; Treasury | AC-06 | — |
| BR-017 | Adjustment reversal is downstream-aware | Billing & Subledgers | Tax; FX; GL; Period; Controls; Treasury | AC-06 | — |
| BR-018 | Deferred invoices cannot be freely adjusted after recognition begins | Billing & Subledgers | Tax; FX; GL; Period; Controls; Treasury | AC-06 | AC-08 |
| BR-019 | Revenue/cost recognition can follow service date | Expense, Commission & Recognition | Billing; Treasury; GL; Period; Controls | AC-08 | — |
| BR-020 | Supplier cancellation charge consumes supplier advance | Billing & Subledgers | Tax; FX; GL; Period; Controls; Treasury | AC-06 | AC-10 |
| BR-021 | Customer cancellation fee consumes customer advance | Billing & Subledgers | Tax; FX; GL; Period; Controls; Treasury | AC-06 | AC-12 |
| BR-022 | Customer write-off cannot exceed receivable | Billing & Subledgers | Tax; FX; GL; Period; Controls; Treasury | AC-06 | — |
| BR-023 | Allowance-backed write-off is doubly capped | Assets & Financing | Billing; Treasury; GL; Period; Controls | AC-09 | — |
| BR-024 | Opening balances may not be posted to revenue/expense | General Ledger | Period; FX; Controls | AC-04 | — |
| BR-025 | Treasury currency/type becomes immutable after history | Treasury & Settlement | Billing allocation service; FX; GL; Period; Controls | AC-07 | — |
| BR-026 | Nonzero treasury cannot be deactivated | Treasury & Settlement | Billing allocation service; FX; GL; Period; Controls | AC-07 | — |
| BR-027 | Negative treasury can be globally prohibited | Treasury & Settlement | Billing allocation service; FX; GL; Period; Controls | AC-07 | — |
| BR-028 | Cash count difference can be posted explicitly | Treasury & Settlement | Billing allocation service; FX; GL; Period; Controls | AC-07 | — |
| BR-029 | Automatic bank-line matching is deliberately conservative | Treasury & Settlement | Billing allocation service; FX; GL; Period; Controls | AC-07 | — |
| BR-030 | Approval policy can prevent self-approval | Financial Controls & Reconciliation | Immutable evidence/projections from relevant owners | AC-05 | AC-08 |
| BR-031 | High-value payment/paid expense can be routed to approval | Financial Controls & Reconciliation | Immutable evidence/projections from relevant owners | AC-05 | AC-08 |
| BR-032 | Expense economic form determines accounting workflow | Expense, Commission & Recognition | Billing; Treasury; GL; Period; Controls | AC-08 | — |
| BR-033 | Prepaid expense schedule preserves total exactly | Expense, Commission & Recognition | Billing; Treasury; GL; Period; Controls | AC-08 | — |
| BR-034 | Commission expense is recognized on approval | Expense, Commission & Recognition | Billing; Treasury; GL; Period; Controls | AC-08 | — |
| BR-035 | Agent commission supports partial/cross-currency settlement | Expense, Commission & Recognition | Billing; Treasury; GL; Period; Controls | AC-08 | — |
| BR-036 | Foreign-currency revaluation excludes P&L and equity positions | Currency & FX | GL through orchestration/event | AC-03 | AC-04 |
| BR-037 | Period closure has blockers and warnings | Financial Controls & Reconciliation | Immutable evidence/projections from relevant owners | AC-05 | AC-12 |
| BR-038 | Fiscal year close is P&L to retained earnings | Period Control | Controls; GL through orchestration/event | AC-04 | — |
| BR-039 | Reopening year reverses the close | Period Control | Controls; GL through orchestration/event | AC-04 | — |
| BR-040 | Same party roles remain separate until formal netting | Party Accounting | Billing allocation service; GL; Controls | AC-08 | — |
| BR-041 | Netting is never automatic | Party Accounting | Billing allocation service; GL; Controls | AC-08 | — |
| BR-042 | Program booking revenue is linked to program cost center | Cost & Budget Accounting | GL event projection; Tourism | AC-03 | AC-12 |
| BR-043 | Confirmation of an Umrah booking is idempotent at integration boundary | Tourism / Hajj / Umrah Finance Orchestration | Billing; Treasury; Recognition; Cost; Inventory; Procurement; Controls | AC-12 | — |
| BR-044 | A paid booking cannot be silently cancelled | Tourism / Hajj / Umrah Finance Orchestration | Billing; Treasury; Recognition; Cost; Inventory; Procurement; Controls | AC-12 | — |
| BR-045 | Paid agent commission is a cancellation blocker | Tourism / Hajj / Umrah Finance Orchestration | Billing; Treasury; Recognition; Cost; Inventory; Procurement; Controls | AC-12 | — |
| BR-046 | Ordinary cancellation stops after travel starts | Tourism / Hajj / Umrah Finance Orchestration | Billing; Treasury; Recognition; Cost; Inventory; Procurement; Controls | AC-12 | — |
| BR-047 | Program cancellation is a controlled aggregate operation | Tourism / Hajj / Umrah Finance Orchestration | Billing; Treasury; Recognition; Cost; Inventory; Procurement; Controls | AC-12 | — |
| BR-048 | Program close is not financial cancellation | Tourism / Hajj / Umrah Finance Orchestration | Billing; Treasury; Recognition; Cost; Inventory; Procurement; Controls | AC-12 | — |
| BR-049 | Clean cancelled program may be deleted; financial history is retained | Tourism / Hajj / Umrah Finance Orchestration | Billing; Treasury; Recognition; Cost; Inventory; Procurement; Controls | AC-12 | — |
| BR-050 | Program booking discount is permission-controlled | Tourism / Hajj / Umrah Finance Orchestration | Billing; Treasury; Recognition; Cost; Inventory; Procurement; Controls | AC-12 | — |
| BR-051 | Selling requires program-open state | Tourism / Hajj / Umrah Finance Orchestration | Billing; Treasury; Recognition; Cost; Inventory; Procurement; Controls | AC-12 | — |
| BR-052 | Booking capacity is multi-dimensional | Tourism Contract Inventory | Procurement; Cost; Tourism | AC-11 | AC-12 |
| BR-053 | Operational readiness can include financial clearance | Tourism / Hajj / Umrah Finance Orchestration | Billing; Treasury; Recognition; Cost; Inventory; Procurement; Controls | AC-12 | — |
| BR-054 | Financial setup is required for key service categories | Tourism / Hajj / Umrah Finance Orchestration | Billing; Treasury; Recognition; Cost; Inventory; Procurement; Controls | AC-12 | — |
| BR-055 | Contract does not automatically create supplier payable | Procurement Finance | Billing; Cost; Controls; Tourism | AC-10 | AC-12 |
| BR-056 | Hotel inventory is date-level and prevents overbooking | Tourism Contract Inventory | Procurement; Cost; Tourism | AC-11 | AC-12 |
| BR-057 | Flight block consumption is aggregate across programs | Tourism Contract Inventory | Procurement; Cost; Tourism | AC-11 | AC-12 |
| BR-058 | Transport capacity is concurrent-period capacity | Tourism Contract Inventory | Procurement; Cost; Tourism | AC-11 | AC-12 |
| BR-059 | Visa quota is cumulative; stop-sale date-sensitive | Tourism Contract Inventory | Procurement; Cost; Tourism | AC-11 | AC-12 |
| BR-060 | Open program cannot silently lose required contract coverage | Tourism Contract Inventory | Procurement; Cost; Tourism | AC-11 | AC-12 |
| BR-061 | Partial allocation change updates inventory and program cost | Tourism Contract Inventory | Procurement; Cost; Tourism | AC-11 | AC-12 |
| BR-062 | Contract amendment is version-like | Tourism Contract Inventory | Procurement; Cost; Tourism | AC-11 | AC-12 |
| BR-063 | Allocation cannot be released through financial history | Tourism Contract Inventory | Procurement; Cost; Tourism | AC-11 | AC-12 |
| BR-064 | Owned inventory before external purchase | Tourism Contract Inventory | Procurement; Cost; Tourism | AC-11 | AC-12 |
| BR-065 | Selling contracted inventory must not duplicate AP | Tourism Contract Inventory | Procurement; Cost; Tourism | AC-11 | AC-12 |
| BR-066 | Confirmed service financial fields are immutable in-place | Tourism / Hajj / Umrah Finance Orchestration | Billing; Treasury; Recognition; Cost; Inventory; Procurement; Controls | AC-12 | — |
| BR-067 | Procurement policy controls actual commitment timing | Procurement Finance | Billing; Cost; Controls; Tourism | AC-10 | AC-12 |
| BR-068 | Visa/ticket issuance can actualize traveler cost | Tourism / Hajj / Umrah Finance Orchestration | Billing; Treasury; Recognition; Cost; Inventory; Procurement; Controls | AC-12 | — |
| BR-069 | Draft auto-PO disposable only while economically empty | Procurement Finance | Billing; Cost; Controls; Tourism | AC-10 | AC-12 |
| BR-070 | Supplier execution is cancellation blocker | Procurement Finance | Billing; Cost; Controls; Tourism | AC-10 | AC-12 |
| BR-071 | Supplier invoice cancellation reopens procurement lifecycle | Procurement Finance | Billing; Cost; Controls; Tourism | AC-10 | AC-12 |
| BR-072 | Server independently protects financial immutability | Financial Controls & Reconciliation | Immutable evidence/projections from relevant owners | AC-05 | AC-13 |
| BR-073 | Permanent financial collections cannot be directly deleted | Financial Controls & Reconciliation | Immutable evidence/projections from relevant owners | AC-05 | AC-13 |
| BR-074 | Branch access enforced on changed financial records | Financial Controls & Reconciliation | Immutable evidence/projections from relevant owners | AC-05 | AC-13 |
| BR-075 | Audit auto-fix is intentionally narrow | Financial Controls & Reconciliation | Immutable evidence/projections from relevant owners | AC-05 | AC-13 |

## Golden Scenarios — 40/40

| Scenario | AC-00 scenario | Acceptance test owner | Collaborating modules | Canonical acceptance phase |
|---|---|---|---|---|
| GS-001 | Balanced customer invoice | Billing & Subledgers | Tax; GL; Period; Controls | AC-06 |
| GS-002 | Supplier invoice with VAT | Billing & Subledgers | Tax; GL; Period; Controls | AC-06 |
| GS-003 | Receipt allocates multiple invoices oldest due first | Treasury & Settlement | Billing allocation service; FX; GL; Controls | AC-07 |
| GS-004 | Receipt before invoice posting | Treasury & Settlement | Billing allocation service; FX; GL; Controls | AC-07 |
| GS-005 | Supplier payment before invoice posting | Treasury & Settlement | Billing allocation service; FX; GL; Controls | AC-07 |
| GS-006 | Contract-linked supplier advance cannot settle unrelated AP | Treasury & Settlement | Billing allocation service; FX; GL; Controls | AC-07 |
| GS-007 | Void receipt reopens invoice | Treasury & Settlement | Billing allocation service; FX; GL; Controls | AC-07 |
| GS-008 | Cross-currency settlement FX | Treasury & Settlement | Billing allocation service; FX; GL; Controls | AC-07 |
| GS-009 | Credit note creates advance | Billing & Subledgers | Tax; GL; Period; Controls | AC-06 |
| GS-010 | Formal party netting | Party Accounting | Billing allocation service; GL; Controls | AC-08 |
| GS-011 | Supplier cancellation split | Expense, Commission & Recognition | Billing; Treasury; GL; Controls | AC-08 |
| GS-012 | Deferred customer revenue | Expense, Commission & Recognition | Billing; Treasury; GL; Controls | AC-08 |
| GS-013 | Deferred supplier cost | Expense, Commission & Recognition | Billing; Treasury; GL; Controls | AC-08 |
| GS-014 | Prepaid expense schedule rounding | Expense, Commission & Recognition | Billing; Treasury; GL; Controls | AC-08 |
| GS-015 | Fixed asset lifecycle | Assets & Financing | Billing; Treasury; GL; Controls | AC-09 |
| GS-016 | Loan amortization | Assets & Financing | Billing; Treasury; GL; Controls | AC-09 |
| GS-017 | Doubtful-debt allowance | Assets & Financing | Billing; Treasury; GL; Controls | AC-09 |
| GS-018 | Payroll | Assets & Financing | Billing; Treasury; GL; Controls | AC-09 |
| GS-019 | Opening customer balance | Billing & Subledgers | Tax; GL; Period; Controls | AC-06 |
| GS-020 | Bank matching | Treasury & Settlement | Billing allocation service; FX; GL; Controls | AC-07 |
| GS-021 | Period close blocker | Financial Controls & Reconciliation | Relevant event-fed projections | AC-05 |
| GS-022 | Fiscal year close/reopen | Period Control | Controls; GL through close orchestration | AC-04 |
| GS-023 | Umrah booking confirmation | Tourism / Hajj / Umrah Finance Orchestration | Billing; Treasury; Recognition; Inventory; Procurement; Controls | AC-12 |
| GS-024 | Umrah booking deposit | Tourism / Hajj / Umrah Finance Orchestration | Billing; Treasury; Recognition; Inventory; Procurement; Controls | AC-12 |
| GS-025 | Paid booking cancellation requires settlement | Tourism / Hajj / Umrah Finance Orchestration | Billing; Treasury; Recognition; Inventory; Procurement; Controls | AC-12 |
| GS-026 | Unpaid booking/program cancellation | Tourism / Hajj / Umrah Finance Orchestration | Billing; Treasury; Recognition; Inventory; Procurement; Controls | AC-12 |
| GS-027 | Supplier execution blocks program cancellation | Tourism / Hajj / Umrah Finance Orchestration | Billing; Treasury; Recognition; Inventory; Procurement; Controls | AC-12 |
| GS-028 | Supplier invoice blocks program cancellation | Tourism / Hajj / Umrah Finance Orchestration | Billing; Treasury; Recognition; Inventory; Procurement; Controls | AC-12 |
| GS-029 | Safe cancellation of approved unconverted auto PO | Procurement Finance | Billing; Cost; Controls | AC-10 |
| GS-030 | Draft auto PO cleanup | Procurement Finance | Billing; Cost; Controls | AC-10 |
| GS-031 | Supplier invoice cancellation reopens PO | Procurement Finance | Billing; Cost; Controls | AC-10 |
| GS-032 | Hotel inventory overbooking | Tourism Contract Inventory | Procurement; Cost; Tourism orchestration | AC-11 |
| GS-033 | Partial hotel allocation adjustment | Tourism Contract Inventory | Procurement; Cost; Tourism orchestration | AC-11 |
| GS-034 | Stop sale | Tourism Contract Inventory | Procurement; Cost; Tourism orchestration | AC-11 |
| GS-035 | Shared flight block across programs | Tourism Contract Inventory | Procurement; Cost; Tourism orchestration | AC-11 |
| GS-036 | Transport non-overlap reuse | Tourism Contract Inventory | Procurement; Cost; Tourism orchestration | AC-11 |
| GS-037 | Internal tourism inventory before external procurement | Tourism Contract Inventory | Procurement; Cost; Tourism orchestration | AC-11 |
| GS-038 | Duplicate visa batch prevention | Tourism Contract Inventory | Procurement; Cost; Tourism orchestration | AC-11 |
| GS-039 | Ticket issuance requires real flight segment | Tourism Contract Inventory | Procurement; Cost; Tourism orchestration | AC-11 |
| GS-040 | Accounting integrity clean gate | Financial Controls & Reconciliation | Relevant event-fed projections | AC-05 |

## Regression policy and completeness gates

- AC-13 may run cross-module financial regression; AC-14 may replay all 40 scenarios for migration equivalence. Both are REGRESSION ONLY and confer no new ownership or implementation phase.
- Unique rule IDs: 75; canonical implementation phases populated: 75; orphan/duplicate rules: 0.
- Unique scenario IDs: 40; canonical acceptance phases populated: 40; orphan/duplicate scenarios: 0.
- Every rule has one owner. Every scenario has one acceptance-test owner.
