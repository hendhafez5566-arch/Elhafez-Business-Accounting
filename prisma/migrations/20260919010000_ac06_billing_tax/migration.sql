-- CreateTable
CREATE TABLE "tax_policies" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "effective_from" DATE NOT NULL,
    "rate" DECIMAL(38,18) NOT NULL,
    "output_account_id" TEXT NOT NULL,
    "input_account_id" TEXT NOT NULL,

    CONSTRAINT "tax_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_snapshots" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "policy_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "effective_at" TIMESTAMP(3) NOT NULL,
    "rate" DECIMAL(38,18) NOT NULL,
    "taxable_amount" DECIMAL(38,18) NOT NULL,
    "tax_amount" DECIMAL(38,18) NOT NULL,
    "output_account_id" TEXT NOT NULL,
    "input_account_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_invoices" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "external_invoice_number" TEXT,
    "posting_date" DATE NOT NULL,
    "currency" TEXT NOT NULL,
    "fx_rate_id" TEXT,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "control_account_id" TEXT NOT NULL,
    "base_total" DECIMAL(38,18) NOT NULL,
    "outstanding" DECIMAL(38,18) NOT NULL,
    "journal_id" TEXT,
    "reversal_journal_id" TEXT,
    "recognition_reference" TEXT,
    "deferred" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_invoice_lines" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "tax_code" TEXT,
    "tax_snapshot_id" TEXT,
    "tax_amount" DECIMAL(38,18),
    "tax_account_id" TEXT,

    CONSTRAINT "billing_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_credit_limits" (
    "company_id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,

    CONSTRAINT "billing_credit_limits_pkey" PRIMARY KEY ("company_id","party_id")
);

-- CreateTable
CREATE TABLE "billing_allocations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "party_kind" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "invoice_id" TEXT,
    "amount" DECIMAL(38,18) NOT NULL,
    "applied_amount" DECIMAL(38,18) NOT NULL,
    "advance_amount" DECIMAL(38,18) NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "restriction_source_type" TEXT,
    "restriction_source_id" TEXT,
    "request_hash" TEXT NOT NULL,
    "reversed_at" TIMESTAMP(3),

    CONSTRAINT "billing_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_advances" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "party_kind" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "available" DECIMAL(38,18) NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "restriction_source_type" TEXT,
    "restriction_source_id" TEXT,
    "generated_by_adjustment_id" TEXT,

    CONSTRAINT "billing_advances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_advance_consumptions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "advance_id" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "reversed_at" TIMESTAMP(3),

    CONSTRAINT "billing_advance_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_adjustments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "journal_id" TEXT NOT NULL,
    "advance_id" TEXT,
    "reversed_at" TIMESTAMP(3),

    CONSTRAINT "billing_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tax_policies_company_id_id_key" ON "tax_policies"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "tax_policies_company_id_code_effective_from_key" ON "tax_policies"("company_id", "code", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "tax_snapshots_company_id_id_key" ON "tax_snapshots"("company_id", "id");

-- CreateIndex
CREATE INDEX "billing_invoices_company_id_party_id_status_idx" ON "billing_invoices"("company_id", "party_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "billing_invoices_company_id_id_key" ON "billing_invoices"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_invoices_company_id_source_type_source_id_key" ON "billing_invoices"("company_id", "source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_invoices_company_id_party_id_external_invoice_numbe_key" ON "billing_invoices"("company_id", "party_id", "external_invoice_number");

-- CreateIndex
CREATE INDEX "billing_invoice_lines_company_id_invoice_id_idx" ON "billing_invoice_lines"("company_id", "invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_invoice_lines_company_id_id_key" ON "billing_invoice_lines"("company_id", "id");

-- CreateIndex
CREATE INDEX "billing_allocations_company_id_invoice_id_idx" ON "billing_allocations"("company_id", "invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_allocations_company_id_id_key" ON "billing_allocations"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_allocations_company_id_source_type_source_id_key" ON "billing_allocations"("company_id", "source_type", "source_id");

-- CreateIndex
CREATE INDEX "billing_advances_company_id_party_kind_party_id_idx" ON "billing_advances"("company_id", "party_kind", "party_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_advances_company_id_id_key" ON "billing_advances"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_advance_consumptions_company_id_id_key" ON "billing_advance_consumptions"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_advance_consumptions_company_id_source_type_source__key" ON "billing_advance_consumptions"("company_id", "source_type", "source_id");

-- CreateIndex
CREATE INDEX "billing_adjustments_company_id_invoice_id_idx" ON "billing_adjustments"("company_id", "invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_adjustments_company_id_id_key" ON "billing_adjustments"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_adjustments_company_id_source_type_source_id_key" ON "billing_adjustments"("company_id", "source_type", "source_id");

-- AddForeignKey
ALTER TABLE "billing_invoice_lines" ADD CONSTRAINT "billing_invoice_lines_company_id_invoice_id_fkey" FOREIGN KEY ("company_id", "invoice_id") REFERENCES "billing_invoices"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
