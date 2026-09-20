-- Carry the existing opaque Cost-owner identity on immutable GL evidence for program reporting.
ALTER TABLE "gl_journal_lines" ADD COLUMN "cost_center_id" TEXT;
CREATE INDEX "gl_journal_lines_company_id_cost_center_id_idx" ON "gl_journal_lines"("company_id", "cost_center_id");
