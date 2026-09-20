CREATE TABLE "qt_quotations" (
 "id" TEXT NOT NULL,"company_id" TEXT NOT NULL,"branch_id" TEXT NOT NULL,"number" TEXT NOT NULL,"source_lead_id" TEXT,"customer_id" TEXT,"customer_display_name" TEXT NOT NULL,"customer_contact_name" TEXT,"customer_phone" TEXT,"customer_email" TEXT,"currency" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'DRAFT',"approval_status" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',"approval_actor_id" TEXT,"approval_at" TIMESTAMP(3),"approval_reason" TEXT,"current_revision_id" TEXT NOT NULL,"accepted_revision_id" TEXT,"rejected_revision_id" TEXT,"rejection_reason" TEXT,"billing_invoice_id" TEXT,"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "qt_quotations_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "qt_quotations_customer_source_check" CHECK (("customer_id" IS NOT NULL) OR ("source_lead_id" IS NOT NULL)),
 CONSTRAINT "qt_quotations_acceptance_check" CHECK (("status" NOT IN ('ACCEPTED','CONVERTED')) OR ("accepted_revision_id" IS NOT NULL)),
 CONSTRAINT "qt_quotations_conversion_check" CHECK (("status" <> 'CONVERTED') OR ("billing_invoice_id" IS NOT NULL))
);
CREATE UNIQUE INDEX "qt_quotations_company_id_branch_id_id_key" ON "qt_quotations"("company_id","branch_id","id");
CREATE UNIQUE INDEX "qt_quotations_company_id_branch_id_number_key" ON "qt_quotations"("company_id","branch_id","number");
CREATE UNIQUE INDEX "qt_quotations_company_id_billing_invoice_id_key" ON "qt_quotations"("company_id","billing_invoice_id");
CREATE INDEX "qt_quotations_company_id_branch_id_status_updated_at_idx" ON "qt_quotations"("company_id","branch_id","status","updated_at");
CREATE INDEX "qt_quotations_company_id_branch_id_source_lead_id_idx" ON "qt_quotations"("company_id","branch_id","source_lead_id");
CREATE INDEX "qt_quotations_company_id_customer_id_idx" ON "qt_quotations"("company_id","customer_id");
CREATE TABLE "qt_revisions" ("id" TEXT NOT NULL,"quotation_id" TEXT NOT NULL,"number" INTEGER NOT NULL,"validity_date" DATE NOT NULL,"notes" TEXT,"terms" TEXT,"subtotal" DECIMAL(24,6) NOT NULL,"discount_total" DECIMAL(24,6) NOT NULL,"total" DECIMAL(24,6) NOT NULL,"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"sent_at" TIMESTAMP(3),CONSTRAINT "qt_revisions_pkey" PRIMARY KEY("id"));
CREATE UNIQUE INDEX "qt_revisions_quotation_id_number_key" ON "qt_revisions"("quotation_id","number");
CREATE TABLE "qt_revision_lines" ("id" TEXT NOT NULL,"revision_id" TEXT NOT NULL,"description" TEXT NOT NULL,"quantity" DECIMAL(24,6) NOT NULL,"unit_price" DECIMAL(24,6) NOT NULL,"discount" DECIMAL(24,6) NOT NULL DEFAULT 0,"tax_code" TEXT,"total" DECIMAL(24,6) NOT NULL,"manual_price_override" BOOLEAN NOT NULL DEFAULT false,"discount_requires_approval" BOOLEAN NOT NULL DEFAULT false,CONSTRAINT "qt_revision_lines_pkey" PRIMARY KEY("revision_id","id"),CONSTRAINT "qt_revision_lines_values_check" CHECK ("quantity">0 AND "unit_price">=0 AND "discount">=0 AND "total">=0));
CREATE TABLE "qt_history" ("id" TEXT NOT NULL,"company_id" TEXT NOT NULL,"branch_id" TEXT NOT NULL,"quotation_id" TEXT NOT NULL,"kind" TEXT NOT NULL,"revision_id" TEXT,"actor_id" TEXT NOT NULL,"detail" TEXT,"occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "qt_history_pkey" PRIMARY KEY("id"));
CREATE INDEX "qt_history_company_id_branch_id_quotation_id_occurred_at_idx" ON "qt_history"("company_id","branch_id","quotation_id","occurred_at");
CREATE TABLE "qt_number_counters" ("company_id" TEXT NOT NULL,"branch_id" TEXT NOT NULL,"next_value" INTEGER NOT NULL DEFAULT 0,CONSTRAINT "qt_number_counters_pkey" PRIMARY KEY("company_id","branch_id"));
ALTER TABLE "qt_revisions" ADD CONSTRAINT "qt_revisions_quotation_id_fkey" FOREIGN KEY("quotation_id") REFERENCES "qt_quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "qt_revision_lines" ADD CONSTRAINT "qt_revision_lines_revision_id_fkey" FOREIGN KEY("revision_id") REFERENCES "qt_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "qt_history" ADD CONSTRAINT "qt_history_company_id_branch_id_quotation_id_fkey" FOREIGN KEY("company_id","branch_id","quotation_id") REFERENCES "qt_quotations"("company_id","branch_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
