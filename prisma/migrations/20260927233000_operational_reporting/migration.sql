CREATE TABLE "or_saved_reports" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "owner_actor_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "report_key" TEXT NOT NULL,
    "filters_json" JSONB NOT NULL DEFAULT '{}',
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "or_saved_reports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "or_saved_reports_company_id_id_key" ON "or_saved_reports"("company_id","id");
CREATE INDEX "or_saved_reports_company_id_owner_actor_id_active_idx" ON "or_saved_reports"("company_id","owner_actor_id","active");
CREATE INDEX "or_saved_reports_company_id_report_key_active_idx" ON "or_saved_reports"("company_id","report_key","active");

CREATE TABLE "or_report_schedules" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "saved_report_id" TEXT NOT NULL,
    "cadence" TEXT NOT NULL,
    "hour_utc" INTEGER NOT NULL,
    "weekday" INTEGER,
    "day_of_month" INTEGER,
    "channel" TEXT NOT NULL,
    "recipient" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "or_report_schedules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "or_report_schedules_company_id_saved_report_id_enabled_idx" ON "or_report_schedules"("company_id","saved_report_id","enabled");
ALTER TABLE "or_report_schedules"
ADD CONSTRAINT "or_report_schedules_company_id_saved_report_id_fkey"
FOREIGN KEY ("company_id","saved_report_id")
REFERENCES "or_saved_reports"("company_id","id")
ON DELETE RESTRICT ON UPDATE CASCADE;
