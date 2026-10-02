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

-- Expense / Commission / Recognition owns the deferred-revenue allocation split used
-- by the legacy invoice workflow. The table intentionally remains ECR-owned and is
-- accessed only through the ECR repository; Billing still owns the invoice itself.
CREATE TABLE "ecr_invoice_revenue_allocations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,

    CONSTRAINT "ecr_invoice_revenue_allocations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ecr_invoice_revenue_allocations_amount_check" CHECK ("amount" > 0),
    CONSTRAINT "ecr_invoice_revenue_allocations_schedule_fkey"
      FOREIGN KEY ("company_id", "schedule_id")
      REFERENCES "ecr_recognition_schedules"("company_id", "id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ecr_invoice_revenue_allocations_company_id_id_key"
  ON "ecr_invoice_revenue_allocations"("company_id", "id");

CREATE INDEX "ecr_invoice_revenue_allocations_company_schedule_idx"
  ON "ecr_invoice_revenue_allocations"("company_id", "schedule_id");
