-- Phase 3 golden workflow parity.
-- Billing remains the canonical invoice owner; this sidecar stores commercial-entry
-- metadata required by the legacy invoice workflow while the existing billing tables
-- remain the accounting source of truth for amounts, status and posting evidence.
CREATE TABLE "billing_invoice_manual_workflows" (
    "company_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_invoice_manual_workflows_pkey" PRIMARY KEY ("company_id", "invoice_id"),
    CONSTRAINT "billing_invoice_manual_workflows_invoice_fkey"
      FOREIGN KEY ("company_id", "invoice_id")
      REFERENCES "billing_invoices"("company_id", "id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "billing_invoice_manual_workflows_updated_idx"
  ON "billing_invoice_manual_workflows"("company_id", "updated_at");
