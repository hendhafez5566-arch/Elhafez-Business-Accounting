ALTER TABLE "billing_invoices" ADD COLUMN "economic_operation_key" TEXT, ADD COLUMN "financial_dimensions" JSONB;
ALTER TABLE "billing_invoice_lines" ADD COLUMN "cost_center_id" TEXT;
ALTER TABLE "billing_advances" ADD COLUMN "base_currency" TEXT, ADD COLUMN "liability_account_id" TEXT;
ALTER TABLE "billing_advance_consumptions" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'POSTED', ADD COLUMN "evidence" JSONB;
CREATE TABLE "billing_financial_operations" (
 "id" TEXT NOT NULL PRIMARY KEY,"company_id" TEXT NOT NULL,"invoice_id" TEXT NOT NULL,
 "kind" TEXT NOT NULL,"source_type" TEXT NOT NULL,"source_id" TEXT NOT NULL,"request_hash" TEXT NOT NULL,
 "snapshot" JSONB NOT NULL,"plan" JSONB,"result" JSONB,"status" TEXT NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "billing_financial_operations_company_id_id_key" ON "billing_financial_operations"("company_id","id");
CREATE UNIQUE INDEX "billing_financial_operations_company_id_source_type_source_id_key" ON "billing_financial_operations"("company_id","source_type","source_id");
ALTER TABLE "billing_adjustments" ADD COLUMN "document_amount" DECIMAL(38,18), ADD COLUMN "document_currency" TEXT, ADD COLUMN "cost_center_id" TEXT;
ALTER TABLE "billing_advances" ADD COLUMN "economic_operation_key" TEXT;
