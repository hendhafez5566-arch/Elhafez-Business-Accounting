ALTER TABLE "cm_customers"
  ADD COLUMN "credit_limit" DECIMAL(24,6),
  ADD COLUMN "credit_days" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "payment_terms" TEXT;
