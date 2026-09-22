CREATE TABLE "hure_closure_evidence" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "program_id" TEXT NOT NULL,
  "program_updated_at" TIMESTAMP(3) NOT NULL,
  "command_key" TEXT NOT NULL,
  "evidence_hash" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  "financial_evidence" JSONB,
  "status" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "hure_closure_evidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hure_close_program_version_uq"
  ON "hure_closure_evidence"("company_id","branch_id","program_id","program_updated_at");
CREATE UNIQUE INDEX "hure_close_command_uq"
  ON "hure_closure_evidence"("company_id","command_key");
CREATE INDEX "hure_close_program_status_idx"
  ON "hure_closure_evidence"("company_id","branch_id","program_id","status","updated_at");
