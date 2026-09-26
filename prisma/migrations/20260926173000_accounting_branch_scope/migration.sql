ALTER TABLE "gl_journals" ADD COLUMN "branch_id" TEXT;
CREATE INDEX "gl_journals_company_id_branch_id_posting_date_idx" ON "gl_journals"("company_id","branch_id","posting_date");
