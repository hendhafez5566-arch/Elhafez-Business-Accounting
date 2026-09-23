ALTER TABLE "dex_jobs" ADD COLUMN "dataset" TEXT;
CREATE INDEX "dex_jobs_company_id_direction_dataset_idx" ON "dex_jobs"("company_id", "direction", "dataset");
