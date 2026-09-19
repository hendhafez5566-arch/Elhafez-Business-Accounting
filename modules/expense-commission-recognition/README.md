# Expense, Commission & Recognition

Owns explicit expense forms, exact prepayments, commission claims, service-date recognition and accrual evidence. External journals, invoices, FX rates and cash vouchers remain opaque owner references.

## GS-011 legacy evidence

The frozen v32.5.66 evidence (`scripts/advanced-accounting-smoke.mjs` and `src/accounting/advanced.ts`, commit `e97fa6d9cb52acb22b676e1b975c1b2332bc9a13`) establishes the controlled split: a 2,000 supplier advance is reduced by a 500 supplier refund and the remaining 1,500 is consumed by a supplier cancellation penalty. The penalty entry debits an explicitly supplied cancellation-expense account and credits an explicitly supplied supplier-advance control account. Legacy semantic account numbers are evidence only and are never hard-coded.
