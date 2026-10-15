-- Existing follow-ups and callers without request IDs remain valid.
ALTER TABLE "cf_followups"
  ADD COLUMN "schedule_request_id" TEXT,
  ADD COLUMN "schedule_actor_id" TEXT,
  ADD COLUMN "schedule_fingerprint" TEXT,
  ADD CONSTRAINT "cf_followups_schedule_request_complete" CHECK (
    ("schedule_request_id" IS NULL AND "schedule_actor_id" IS NULL AND "schedule_fingerprint" IS NULL)
    OR ("schedule_request_id" IS NOT NULL AND "schedule_actor_id" IS NOT NULL AND "schedule_fingerprint" IS NOT NULL)
  );
CREATE UNIQUE INDEX "cf_followups_schedule_request_key"
  ON "cf_followups"("company_id", "branch_id", "schedule_actor_id", "schedule_request_id");
