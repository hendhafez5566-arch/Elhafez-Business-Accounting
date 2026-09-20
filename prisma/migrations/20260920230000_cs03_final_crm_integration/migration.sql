-- CS-03 — Final CRM integration: Traveler Management + quotation outbound evidence.
-- Additive and forward-only. No accepted migration is modified.

CREATE TABLE "tvm_travelers" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "full_name" TEXT NOT NULL,
  "date_of_birth" DATE,
  "gender" TEXT,
  "nationality" TEXT,
  "party_id" TEXT,
  "customer_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tvm_travelers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tvm_travelers_company_id_id_key" ON "tvm_travelers"("company_id", "id");
CREATE INDEX "tvm_travelers_company_id_customer_id_idx" ON "tvm_travelers"("company_id", "customer_id");
CREATE INDEX "tvm_travelers_company_id_party_id_idx" ON "tvm_travelers"("company_id", "party_id");
CREATE INDEX "tvm_travelers_company_id_status_full_name_idx" ON "tvm_travelers"("company_id", "status", "full_name");

CREATE TABLE "tvm_travel_documents" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "traveler_id" TEXT NOT NULL,
  "document_type" TEXT NOT NULL DEFAULT 'PASSPORT',
  "document_number" TEXT NOT NULL,
  "issuing_country" TEXT,
  "issuing_place" TEXT,
  "holder_name_snapshot" TEXT NOT NULL,
  "issue_date" DATE,
  "expiry_date" DATE,
  "is_current" BOOLEAN NOT NULL DEFAULT true,
  "superseded_by_document_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tvm_travel_documents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tvm_travel_documents_company_id_id_key" ON "tvm_travel_documents"("company_id", "id");
CREATE UNIQUE INDEX "tvm_travel_documents_company_id_document_number_key" ON "tvm_travel_documents"("company_id", "document_number");
CREATE INDEX "tvm_travel_documents_company_id_traveler_id_is_current_idx" ON "tvm_travel_documents"("company_id", "traveler_id", "is_current");
ALTER TABLE "tvm_travel_documents" ADD CONSTRAINT "tvm_travel_documents_traveler_fkey" FOREIGN KEY ("company_id", "traveler_id") REFERENCES "tvm_travelers"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "tvm_legacy_import_records" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "legacy_source_system" TEXT NOT NULL,
  "legacy_source_reference" TEXT NOT NULL,
  "traveler_id" TEXT NOT NULL,
  "travel_document_id" TEXT NOT NULL,
  "input_fingerprint" TEXT NOT NULL,
  "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tvm_legacy_import_records_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tvm_legacy_import_records_company_source_reference_key" ON "tvm_legacy_import_records"("company_id", "legacy_source_system", "legacy_source_reference");
CREATE INDEX "tvm_legacy_import_records_company_id_branch_id_imported_at_idx" ON "tvm_legacy_import_records"("company_id", "branch_id", "imported_at");
CREATE INDEX "tvm_legacy_import_records_company_id_traveler_id_idx" ON "tvm_legacy_import_records"("company_id", "traveler_id");
ALTER TABLE "tvm_legacy_import_records" ADD CONSTRAINT "tvm_legacy_import_records_traveler_fkey" FOREIGN KEY ("company_id", "traveler_id") REFERENCES "tvm_travelers"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tvm_legacy_import_records" ADD CONSTRAINT "tvm_legacy_import_records_document_fkey" FOREIGN KEY ("company_id", "travel_document_id") REFERENCES "tvm_travel_documents"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "qt_communications" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "quotation_id" TEXT NOT NULL,
  "revision_id" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "recipient_snapshot" TEXT,
  "actor_id" TEXT NOT NULL,
  "external_reference" TEXT,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "qt_communications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "qt_revisions_quotation_id_id_key" ON "qt_revisions"("quotation_id", "id");
CREATE INDEX "qt_communications_company_id_branch_id_quotation_id_occurred_at_idx" ON "qt_communications"("company_id", "branch_id", "quotation_id", "occurred_at");
CREATE INDEX "qt_communications_revision_id_occurred_at_idx" ON "qt_communications"("revision_id", "occurred_at");
ALTER TABLE "qt_communications" ADD CONSTRAINT "qt_communications_quotation_fkey" FOREIGN KEY ("company_id", "branch_id", "quotation_id") REFERENCES "qt_quotations"("company_id", "branch_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "qt_communications" ADD CONSTRAINT "qt_communications_revision_fkey" FOREIGN KEY ("quotation_id", "revision_id") REFERENCES "qt_revisions"("quotation_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
