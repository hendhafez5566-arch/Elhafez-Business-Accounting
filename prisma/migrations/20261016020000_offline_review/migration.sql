ALTER TABLE "oc_commands" ADD COLUMN "review_history" JSONB NOT NULL DEFAULT '[]'::jsonb;
