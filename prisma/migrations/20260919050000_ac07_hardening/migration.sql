-- AC-07 hardening: preserve draft pre-funding accounting evidence without rewriting AC-07 baseline migration.
ALTER TABLE "billing_allocations"
  ADD COLUMN "prefunding_base_amount" DECIMAL(38,18),
  ADD COLUMN "prefunding_account_id" TEXT,
  ADD COLUMN "reclassification_journal_id" TEXT,
  ADD COLUMN "reclassification_reversal_journal_id" TEXT;

ALTER TABLE "billing_allocations"
  ADD CONSTRAINT "billing_allocations_prefunding_base_check"
  CHECK ("prefunding_base_amount" IS NULL OR "prefunding_base_amount" >= 0);
