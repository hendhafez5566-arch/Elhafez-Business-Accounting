# Assets & Financing

AC-09 owns fixed assets, loan accounting, provisions, doubtful-debt allowances, and payroll accounting runs. Cash/bank movements are delegated to Treasury; journal creation is delegated to General Ledger.

## Deliberate evidence boundaries

- Straight-line depreciation is the only supported method.
- Asset, loan, and payroll workflows currently accept base-currency amounts only. Foreign-currency variants are rejected until an approved carrying-value and settlement-FX policy exists.
- Unused allowance release is supported through immutable linked GL evidence. Reversal of an already completed Billing-owned receivable write-off is **UNKNOWN / NEEDS EVIDENCE** and is not invented by this module.
- The module receives calculated payroll totals; it does not calculate salary, tax, insurance, attendance, leave, or overtime.
