ALTER TABLE "pc_notifications"
ADD COLUMN "company_id" TEXT;

CREATE INDEX "pc_notifications_user_id_company_id_read_at_idx"
ON "pc_notifications"("user_id", "company_id", "read_at");
