-- AlterTable
ALTER TABLE "billing_invoices" ADD COLUMN     "due_date" DATE;

-- AlterTable
ALTER TABLE "billing_allocations" ADD COLUMN     "carrying_base_amount" DECIMAL(38,18),
ADD COLUMN     "realized_fx" DECIMAL(38,18),
ADD COLUMN     "settlement_base_amount" DECIMAL(38,18),
ADD COLUMN     "settlement_fx_rate_id" TEXT,
ADD COLUMN     "settlement_id" TEXT,
ADD COLUMN     "settlement_sequence" INTEGER;

-- CreateTable
CREATE TABLE "billing_settlement_groups" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_settlement_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treasury_treasuries" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "gl_account_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "treasury_treasuries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treasury_company_policies" (
    "company_id" TEXT NOT NULL,
    "allow_negative" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "treasury_company_policies_pkey" PRIMARY KEY ("company_id")
);

-- CreateTable
CREATE TABLE "treasury_vouchers" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "treasury_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "party_kind" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "posting_date" DATE NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "actor_id" TEXT,
    "approval_request_id" TEXT,
    "journal_id" TEXT,
    "reversal_journal_id" TEXT,
    "settlement_id" TEXT,
    "allocation_ids" JSONB NOT NULL,
    "advance_id" TEXT,
    "carrying_base_amount" DECIMAL(38,18),
    "settlement_base_amount" DECIMAL(38,18),
    "realized_fx" DECIMAL(38,18),
    "fx_rate_id" TEXT,

    CONSTRAINT "treasury_vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treasury_voucher_allocation_refs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "voucher_id" TEXT NOT NULL,
    "allocation_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,

    CONSTRAINT "treasury_voucher_allocation_refs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treasury_transfers" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "source_treasury_id" TEXT NOT NULL,
    "destination_treasury_id" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "posting_date" DATE NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "journal_id" TEXT,

    CONSTRAINT "treasury_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treasury_cheques" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "voucher_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "bank_treasury_id" TEXT,
    "number" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "currency" TEXT NOT NULL,
    "issue_date" DATE NOT NULL,
    "due_date" DATE,
    "status" TEXT NOT NULL,
    "clearing_reference" TEXT,
    "history" JSONB NOT NULL,

    CONSTRAINT "treasury_cheques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treasury_cash_counts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "treasury_id" TEXT NOT NULL,
    "counted_amount" DECIMAL(38,18) NOT NULL,
    "book_amount" DECIMAL(38,18) NOT NULL,
    "difference" DECIMAL(38,18) NOT NULL,
    "count_date" DATE NOT NULL,
    "adjustment_account_id" TEXT,
    "adjustment_journal_id" TEXT,

    CONSTRAINT "treasury_cash_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treasury_bank_statement_lines" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "treasury_id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "signed_amount" DECIMAL(38,18) NOT NULL,
    "value_date" DATE NOT NULL,
    "reference" TEXT,
    "status" TEXT NOT NULL,

    CONSTRAINT "treasury_bank_statement_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treasury_bank_matches" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "line_id" TEXT NOT NULL,
    "voucher_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "actor_id" TEXT,
    "matched_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treasury_bank_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_settlement_groups_company_id_id_key" ON "billing_settlement_groups"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "treasury_treasuries_company_id_id_key" ON "treasury_treasuries"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "treasury_treasuries_company_id_code_key" ON "treasury_treasuries"("company_id", "code");

-- CreateIndex
CREATE INDEX "treasury_vouchers_company_id_treasury_id_status_idx" ON "treasury_vouchers"("company_id", "treasury_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "treasury_vouchers_company_id_id_key" ON "treasury_vouchers"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "treasury_vouchers_company_id_source_type_source_id_key" ON "treasury_vouchers"("company_id", "source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "treasury_voucher_allocation_refs_company_id_voucher_id_sequ_key" ON "treasury_voucher_allocation_refs"("company_id", "voucher_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "treasury_voucher_allocation_refs_company_id_allocation_id_key" ON "treasury_voucher_allocation_refs"("company_id", "allocation_id");

-- CreateIndex
CREATE UNIQUE INDEX "treasury_transfers_company_id_id_key" ON "treasury_transfers"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "treasury_transfers_company_id_source_type_source_id_key" ON "treasury_transfers"("company_id", "source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "treasury_cheques_company_id_id_key" ON "treasury_cheques"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "treasury_cash_counts_company_id_id_key" ON "treasury_cash_counts"("company_id", "id");

-- CreateIndex
CREATE INDEX "treasury_bank_statement_lines_company_id_treasury_id_status_idx" ON "treasury_bank_statement_lines"("company_id", "treasury_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "treasury_bank_statement_lines_company_id_id_key" ON "treasury_bank_statement_lines"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "treasury_bank_matches_line_id_key" ON "treasury_bank_matches"("line_id");

-- CreateIndex
CREATE UNIQUE INDEX "treasury_bank_matches_company_id_line_id_key" ON "treasury_bank_matches"("company_id", "line_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_allocations_company_id_settlement_id_settlement_seq_key" ON "billing_allocations"("company_id", "settlement_id", "settlement_sequence");

-- AddForeignKey
ALTER TABLE "treasury_vouchers" ADD CONSTRAINT "treasury_vouchers_company_id_treasury_id_fkey" FOREIGN KEY ("company_id", "treasury_id") REFERENCES "treasury_treasuries"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_voucher_allocation_refs" ADD CONSTRAINT "treasury_voucher_allocation_refs_company_id_voucher_id_fkey" FOREIGN KEY ("company_id", "voucher_id") REFERENCES "treasury_vouchers"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_transfers" ADD CONSTRAINT "treasury_transfers_company_id_source_treasury_id_fkey" FOREIGN KEY ("company_id", "source_treasury_id") REFERENCES "treasury_treasuries"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_transfers" ADD CONSTRAINT "treasury_transfers_company_id_destination_treasury_id_fkey" FOREIGN KEY ("company_id", "destination_treasury_id") REFERENCES "treasury_treasuries"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_cheques" ADD CONSTRAINT "treasury_cheques_company_id_voucher_id_fkey" FOREIGN KEY ("company_id", "voucher_id") REFERENCES "treasury_vouchers"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_cheques" ADD CONSTRAINT "treasury_cheques_company_id_bank_treasury_id_fkey" FOREIGN KEY ("company_id", "bank_treasury_id") REFERENCES "treasury_treasuries"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_cash_counts" ADD CONSTRAINT "treasury_cash_counts_company_id_treasury_id_fkey" FOREIGN KEY ("company_id", "treasury_id") REFERENCES "treasury_treasuries"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_bank_statement_lines" ADD CONSTRAINT "treasury_bank_statement_lines_company_id_treasury_id_fkey" FOREIGN KEY ("company_id", "treasury_id") REFERENCES "treasury_treasuries"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_bank_matches" ADD CONSTRAINT "treasury_bank_matches_company_id_line_id_fkey" FOREIGN KEY ("company_id", "line_id") REFERENCES "treasury_bank_statement_lines"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
