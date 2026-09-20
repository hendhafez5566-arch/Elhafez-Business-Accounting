# CS-02 — Sales & Quotations

## Ownership and boundaries

`quotations` is the sole company-and-branch scoped owner of quotation identity/number, commercial snapshots, immutable revisions and lines, lifecycle/history, internal commercial approval evidence, customer response evidence, and the opaque Billing conversion reference. Customer and Lead identity remain with CS-01 owners; invoices, tax posting, receivables, and GL effects remain Billing/Accounting truth.

The lightweight `@elhafez/quotations` root exposes application/domain contracts. Nest composition is available only from `@elhafez/quotations/nest`. Quotation-owned ports isolate all external dependencies.

## Lifecycle, revisions, and approval

The lifecycle is `DRAFT → SENT → ACCEPTED → CONVERTED`, with terminal customer `REJECTED` and explicit date-driven `EXPIRED` outcomes. A DRAFT revision is editable. A sent revision is immutable; editing after SENT/REJECTED creates a new numbered DRAFT revision while preserving prior evidence. Acceptance and rejection point to the exact sent revision; rejection requires a reason. Conversion always consumes the accepted revision.

Manual price override or a caller-declared discount requiring approval produces `PENDING` approval. Dedicated approve/reject commands preserve actor, time, and reason. Sending is blocked unless required approval is `APPROVED`. This quotation-owned commercial approval is separate from both customer acceptance and Financial Controls.

## Lead, Customer, and Billing collaboration

Direct quotations validate an active Customer through Customer Management and retain a commercial contact snapshot plus an opaque Customer ID/reference. Lead-origin creation validates a same-company/branch eligible Lead, persists the quotation, calls the public idempotent `markQuoted`, and invokes the public Lead-to-Customer workflow. Duplicate or suspended matches preserve the quotation/Lead and return review-required without fabricating a Customer; Billing conversion remains blocked.

Accepted conversion validates an active Customer and complete caller-provided accounting mapping, then calls Billing's public create/post lifecycle with deterministic source identity `quotationId:acceptedRevisionId`. Only a successful posted invoice marks the quotation CONVERTED. Billing failures leave it ACCEPTED and retries converge on Billing's source idempotency.

## Isolation, permissions, and persistence

Every operation enforces company/branch access plus one of `crm.quotation.read`, `manage`, `send`, `approve`, `respond`, or `convert`. Tables are `qt_quotations`, `qt_revisions`, `qt_revision_lines`, `qt_history`, and `qt_number_counters`. Exact decimals, scoped uniqueness, immutable revision history, accepted-revision evidence, conversion identity, and branch-scoped numbering are protected in application and persistence layers.
