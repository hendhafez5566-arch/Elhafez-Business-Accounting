-- Disposable/rebuildable Financial Reporting evidence projection; never accounting source truth.
CREATE TABLE "fr_reporting_evidence" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "evidence_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "kind" TEXT NOT NULL,
  "posting_date" DATE NOT NULL,
  "payload" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "authoritative_source_type" TEXT NOT NULL,
  "authoritative_source_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fr_reporting_evidence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fr_reporting_evidence_company_id_evidence_id_key" ON "fr_reporting_evidence"("company_id", "evidence_id");
CREATE INDEX "fr_reporting_evidence_company_id_branch_id_posting_date_idx" ON "fr_reporting_evidence"("company_id", "branch_id", "posting_date");
CREATE INDEX "fr_reporting_evidence_company_id_kind_posting_date_idx" ON "fr_reporting_evidence"("company_id", "kind", "posting_date");
