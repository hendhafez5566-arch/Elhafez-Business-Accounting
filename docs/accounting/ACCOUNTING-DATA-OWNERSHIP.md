# Accounting Data Ownership

One object has exactly one command-side owner. References held elsewhere are immutable IDs/snapshots, never a second truth.

| Financial object | Sole owner | Authoritative truth / note |
|---|---|---|
| Accounts | General Ledger | account master/hierarchy/posting status |
| Journals / Journal Lines | General Ledger | posted accounting history |
| Manual/recurring journals | General Ledger | templates/drafts and generated refs |
| Fiscal Years / Periods | Period Control | state and close/reopen metadata |
| Currencies / FX Rates / Revaluations | Currency & FX | effective rates and run details |
| Taxes | Tax | codes, policies, frozen snapshots, tax facts |
| Invoices / lines | Billing & Subledgers | lifecycle, source, tax snapshot refs |
| Credit/Debit Adjustments | Billing & Subledgers | adjustment/reversal lifecycle |
| Receivables / Payables | Billing & Subledgers | invoice/adjustment/Billing-owned-allocation-derived open positions |
| Customer/Supplier/Agent Advances | Billing & Subledgers | first-class open/consumed positions; supplier source restriction retained |
| Economic Settlement / Netting Allocations | Billing & Subledgers | sole authoritative allocation record and reversal chain; source voucher/netting IDs, oldest-due order, carrying base, settlement rate, realized FX and advance effect |
| Receipts / Payments | Treasury & Settlement | voucher lifecycle |
| Treasury allocation references | Treasury & Settlement | immutable IDs/status projection pointing to Billing-owned allocations; never an authoritative allocation ledger |
| Cheques | Treasury & Settlement | instrument lifecycle |
| Treasuries / Transfers / Cash Counts | Treasury & Settlement | master and cash workflows |
| Bank reconciliation / statement matches | Treasury & Settlement | statement and match lifecycle |
| Party accounting groups / Netting | Party Accounting | links and formal reversible netting documents |
| Expenses / Prepayments | Expense, Commission & Recognition | economic form and schedules |
| Commissions | Expense, Commission & Recognition | rule, claim, approval/payment refs |
| Deferred Revenue / Deferred Cost | Expense, Commission & Recognition | schedules and recognized parts |
| Accrued Revenue | Expense, Commission & Recognition | accrual and later invoice settlement |
| Approvals | Financial Controls & Reconciliation | request, decision, limits and no-self-approval evidence |
| Fixed Assets | Assets & Financing | asset/depreciation/disposal lifecycle |
| Loans | Assets & Financing | loan and installment schedules |
| Provisions / Doubtful Debts | Assets & Financing | balances, use, reversal evidence |
| Payroll Accounting | Assets & Financing | accounting run only; HR owns payroll calculation |
| Budgets / Cost Centers | Cost & Budget Accounting | hierarchy, budget and program link |
| Supplier Commitments | Procurement Finance | commitment lifecycle |
| Purchase Orders / receipt & invoiced quantities | Procurement Finance | procurement lifecycle/reopen state |
| Procurement financial references | Procurement Finance | links to Billing/GL by immutable IDs |
| Contract inventory/capacity/reservations | Tourism Contract Inventory | contract versions and operational allocation |
| Program/Booking operational state | Tourism domain (external bounded context) | Accounting stores references only |
| Program financial workflow references | Tourism Finance Orchestration | correlation and outcomes, not duplicated balances |
| Reconciliation issues | Financial Controls & Reconciliation | derived evidence, never source truth |
| Financial report projections | Financial Reporting | disposable/rebuildable views only |

## Balance rules

- GL account balances derive from posted journal lines.
- AR/AP and advances derive from Billing documents plus Billing-owned allocation/reversal records, reconciled to GL control accounts.
- Treasury owns receipt/payment/cheque cash facts, but cannot authoritatively decide or persist invoice application. It calls Billing's allocation port and stores the returned allocation IDs only.
- A Billing allocation may use source type TREASURY_VOUCHER, PARTY_NETTING, or an approved future source. The same engine enforces oldest-due ordering, pre-funded draft linkage, source-specific supplier advances, excess-to-advance, reversal lineage and realized FX.
- Treasury book position derives from posted treasury workflows and GL; cash/bank statements are reconciliation evidence, not substitute balances.
- Program actual/profit derives from GL lines tagged with the owned cost-center reference; operational estimated cost remains an operational/procurement fact.
- Tax reports derive from frozen tax facts and reconcile to GL.
- No cached/report balance may accept commands or become authoritative.
