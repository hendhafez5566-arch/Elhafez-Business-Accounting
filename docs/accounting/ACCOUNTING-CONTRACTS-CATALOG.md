# Accounting Contracts Catalog

All contracts are versioned. Common envelope: `contractVersion`, `companyId`, `branchId`, `actorId`, `correlationId`, `causationId`, `sourceType`, `sourceId`, `occurredAt`, and where required `idempotencyKey`/`expectedRevision`. Exact transport and global idempotency are open decisions.

| Contract / event v1 | Producer → consumer | Required outcome / invariant |
|---|---|---|
| `PostingInstruction` / `JournalPosted|Rejected` | financial owner → GL | balanced immutable journal; source uniqueness; control dimensions |
| `ReverseJournal` / `JournalReversed` | source owner → GL | linked reversal, never deletion |
| `AuthorizePostingDate` | posting owner → Period | closed period/year is blocked |
| `ResolveFxRate`, `CalculateSettlementFx` | consumers → FX | dated snapshot and realized FX |
| `SnapshotTax` | Billing/Expense → Tax | posted lines retain frozen tax policy |
| `BookingConfirmed` | Tourism → Orchestration | idempotent customer/agent invoice, program cost center, optional commission |
| `CreateSourceInvoice` / `InvoiceOutcome` | Orchestration/Procurement → Billing | one source invoice; supplier external number unique per supplier |
| `BookingDepositRequested` | Tourism → Orchestration | receipt may pre-fund draft/pending invoice; allocate or advance |
| `CollectOrPay` / `VoucherPosted` | workflow → Treasury | Treasury owns receipt/payment only and returns voucher reference |
| `ApplyEconomicAllocation` / `EconomicAllocationApplied` | Treasury or Party Accounting → Billing | Billing creates the sole authoritative allocation; oldest-due, pre-funding, source-restricted advance, netting, excess advance and realized FX |
| `ReverseEconomicAllocation` / `EconomicAllocationReversed` | source workflow → Billing | linked reversal; Treasury/Party projections update by event/reference |
| `GetBookingCancellationBlockers` | Tourism → Orchestration | collections, commission, supplier execution/invoice and travel-state facts |
| `BookingCancellationRequested` | Tourism → Orchestration | refund-required or safe linked reversals; replay after settlement |
| `ProgramCancellationRequested` | Tourism → Orchestration | aggregate blockers and controlled compensation; no silent deletion |
| `ProgramCostDefined|ActualizationMilestoneReached` | Tourism/Inventory → Procurement | policy-based commitment timing; allocation is not automatically AP |
| `CreateSupplierCommitment` | Orchestration → Procurement | source-key uniqueness and cost-center link |
| `Create/Approve/Receive/VoidPO` | Procurement clients → Procurement | received/invoiced quantities preserved; execution blocks cancellation |
| `SupplierInvoiceRequested` / `SupplierInvoicePosted` | Procurement ↔ Billing | PO/commitment refs retained, advance source restrictions honored |
| `SupplierInvoiceReversed` | Billing → Procurement | rollback invoiced quantity; reopen PO and commitment; replacement allowed |
| `ResolveInternalFirstFulfillment` | Tourism → Inventory | company inventory first; only shortage emitted for external procurement |
| `Reserve/Adjust/ReleaseInventory` | Tourism → Inventory | hotel date, aggregate flight, overlap transport, visa quota rules |
| `InventoryAllocationCostChanged` | Inventory → Orchestration/Cost | update program cost atomically in owner; preserve history/version |
| `TreasurySettlementCompleted` | Treasury → workflow | voucher plus immutable Billing allocation references; no duplicate allocation truth |
| `EvaluatePeriodClose` | Period → Controls | blockers distinct from warnings; integrity, pending approval, FX checks |
| `PrepareFiscalYearClose` | Period → GL | P&L to retained earnings; reopen reverses close |
| `Propose/Execute/ReversePartyNetting` | Party Accounting → Billing/GL | never automatic; allocations and GL posting are one auditable workflow |
| `EvaluateCreditLimit` | Billing command path → Billing policy | check before posting customer invoice |
| `RequestApproval` / `ApprovalDecided` | owners ↔ Controls | threshold, permission, no self approval |
| `GetProgramAccountingSnapshot` | Tourism/Reporting → Cost/GL read ports | derived revenue/cost/profit; no copied balance |
| `ReconcileSubledgerToGL`, `ReconcileTaxToGL` | Controls → read ports | evidence-only issue; repair through owner command |

## Failure rules

- Duplicate with same locally defined identity returns the original result where an idempotency rule exists; conflicting payload is rejected. Global policy remains OPEN.
- Timeout/unknown outcome is queried by correlation/idempotency key; callers do not create a second economic document blindly.
- Events never authorize an illegal state transition merely because delivery is late or repeated.
- Allocation commands are idempotent by source type + source ID + allocation intent. Billing owns their records/effects; Treasury, Party Accounting, GL and Reporting consume references/events only.
- No HTTP/local transport choice or outbox guarantee is fixed by AC-01.
