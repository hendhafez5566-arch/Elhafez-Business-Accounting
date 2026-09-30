-- Functional closure: the internal Umrah barcode lifecycle. No provider format is inferred.
CREATE TABLE "hub_barcode_records" (
  "id" TEXT NOT NULL, "company_id" TEXT NOT NULL, "branch_id" TEXT NOT NULL,
  "program_id" TEXT NOT NULL, "visa_case_id" TEXT NOT NULL, "traveler_id" TEXT NOT NULL,
  "code" TEXT NOT NULL, "status" TEXT NOT NULL, "assigned_by" TEXT NOT NULL,
  "assigned_at" TIMESTAMP(3) NOT NULL, "updated_at" TIMESTAMP(3) NOT NULL, "revision" INTEGER NOT NULL,
  CONSTRAINT "hub_barcode_records_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "hub_barcode_records_company_id_branch_id_id_key" ON "hub_barcode_records"("company_id","branch_id","id");
CREATE UNIQUE INDEX "hub_barcode_records_company_id_branch_id_code_key" ON "hub_barcode_records"("company_id","branch_id","code");
CREATE UNIQUE INDEX "hub_barcode_records_company_id_branch_id_visa_case_id_key" ON "hub_barcode_records"("company_id","branch_id","visa_case_id");
CREATE INDEX "hub_barcode_records_company_id_branch_id_program_id_status_idx" ON "hub_barcode_records"("company_id","branch_id","program_id","status");
CREATE TABLE "hub_barcode_history" (
  "id" TEXT NOT NULL, "company_id" TEXT NOT NULL, "branch_id" TEXT NOT NULL, "barcode_id" TEXT NOT NULL,
  "from_status" TEXT, "to_status" TEXT NOT NULL, "actor_id" TEXT NOT NULL, "reason" TEXT, "occurred_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hub_barcode_history_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "hub_barcode_history_company_id_branch_id_id_key" ON "hub_barcode_history"("company_id","branch_id","id");
CREATE INDEX "hub_barcode_history_company_id_branch_id_barcode_id_occurred_at_idx" ON "hub_barcode_history"("company_id","branch_id","barcode_id","occurred_at");
ALTER TABLE "hub_barcode_history" ADD CONSTRAINT "hub_barcode_history_company_id_branch_id_barcode_id_fkey" FOREIGN KEY ("company_id","branch_id","barcode_id") REFERENCES "hub_barcode_records"("company_id","branch_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Branch provenance is additive for existing rows. Legacy NULL rows are quarantined from branch-scoped reads
-- until the reconciliation rehearsal assigns them; new API writes always persist a branch.
ALTER TABLE "treasury_treasuries" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "treasury_transfers" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "treasury_cash_counts" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "treasury_bank_statement_lines" ADD COLUMN "branch_id" TEXT;
DROP INDEX IF EXISTS "treasury_treasuries_company_id_code_key";
CREATE UNIQUE INDEX "treasury_treasuries_company_id_branch_id_code_key" ON "treasury_treasuries"("company_id","branch_id","code");
CREATE INDEX "treasury_treasuries_company_id_branch_id_active_idx" ON "treasury_treasuries"("company_id","branch_id","active");
CREATE INDEX "treasury_transfers_company_id_branch_id_status_idx" ON "treasury_transfers"("company_id","branch_id","status");
CREATE INDEX "treasury_cash_counts_company_id_branch_id_count_date_idx" ON "treasury_cash_counts"("company_id","branch_id","count_date");
DROP INDEX IF EXISTS "treasury_bank_statement_lines_company_id_treasury_id_status_idx";
CREATE INDEX "treasury_bank_statement_lines_company_id_branch_id_treasury_id_status_idx" ON "treasury_bank_statement_lines"("company_id","branch_id","treasury_id","status");
