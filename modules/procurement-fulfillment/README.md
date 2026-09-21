# Procurement Fulfillment

SP-02 operational owner for supplier receipt/execution evidence.

- Purchase Order identity, economic received/invoiced quantities and invoice conversion remain owned by `procurement-finance`.
- This module stores immutable operational receipt/correction evidence and delegates quantity mutations through the Procurement Finance public application service.
- Supplier invoice/payable truth remains Billing-owned.
- Every operational command is company + branch scoped and retry-safe.
