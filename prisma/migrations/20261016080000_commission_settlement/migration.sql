ALTER TABLE "ecr_commission_claims" ADD COLUMN "approval_intent" JSONB, ADD COLUMN "settlement_id" TEXT;
CREATE TABLE "ecr_commission_settlements" (
 "id" TEXT NOT NULL PRIMARY KEY, "company_id" TEXT NOT NULL, "branch_id" TEXT NOT NULL,
 "request_hash" TEXT NOT NULL, "actor_id" TEXT NOT NULL, "reason" TEXT NOT NULL,
 "posting_date" TEXT NOT NULL, "number" TEXT NOT NULL, "currency" TEXT NOT NULL,
 "claims" JSONB NOT NULL, "total" DECIMAL(38,18) NOT NULL, "base_total" DECIMAL(38,18) NOT NULL,
 "status" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ecr_commission_settlements_company_id_id_key" ON "ecr_commission_settlements"("company_id", "id");

ALTER TABLE "tfo_booking_references" ADD COLUMN "mutation_key" TEXT, ADD COLUMN "agent_commission_state" JSONB;
ALTER TABLE "tfo_booking_references" ADD COLUMN "completed_mutation_keys" JSONB;
ALTER TABLE "hub_bookings" ADD COLUMN "financial_mutation" JSONB;
