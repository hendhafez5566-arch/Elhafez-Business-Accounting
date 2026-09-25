-- FC-02 / Final Closure: canonical Accounting workspace permissions and general-tourism owners.
-- Additive only. No accepted historical migration is modified.

CREATE TABLE "tpr_programs" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name_ar" TEXT NOT NULL,
  "name_en" TEXT,
  "departure_date" TIMESTAMP(3) NOT NULL,
  "return_date" TIMESTAMP(3) NOT NULL,
  "sales_open" TIMESTAMP(3) NOT NULL,
  "sales_close" TIMESTAMP(3) NOT NULL,
  "currency" TEXT NOT NULL,
  "notes" TEXT,
  "status" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tpr_programs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tpr_programs_id_company_id_branch_id_key" ON "tpr_programs"("id","company_id","branch_id");
CREATE UNIQUE INDEX "tpr_programs_company_id_branch_id_code_key" ON "tpr_programs"("company_id","branch_id","code");
CREATE INDEX "tpr_programs_company_id_branch_id_status_departure_date_idx" ON "tpr_programs"("company_id","branch_id","status","departure_date");

CREATE TABLE "tpr_program_history" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "program_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "reason" TEXT,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tpr_program_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tpr_program_history_company_id_branch_id_program_id_occurred_at_idx" ON "tpr_program_history"("company_id","branch_id","program_id","occurred_at");

CREATE TABLE "tit_itinerary_days" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "program_id" TEXT NOT NULL,
  "day_number" INTEGER NOT NULL,
  "service_date" TIMESTAMP(3) NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "location" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tit_itinerary_days_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tit_itinerary_days_id_company_id_branch_id_key" ON "tit_itinerary_days"("id","company_id","branch_id");
CREATE UNIQUE INDEX "tit_itinerary_days_company_id_branch_id_program_id_day_number_key" ON "tit_itinerary_days"("company_id","branch_id","program_id","day_number");
CREATE INDEX "tit_itinerary_days_company_id_branch_id_program_id_service_date_idx" ON "tit_itinerary_days"("company_id","branch_id","program_id","service_date");

CREATE TABLE "tit_itinerary_history" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "program_id" TEXT NOT NULL,
  "itinerary_day_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tit_itinerary_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tit_itinerary_history_company_id_branch_id_program_id_itinerary_day_id_occurred_at_idx" ON "tit_itinerary_history"("company_id","branch_id","program_id","itinerary_day_id","occurred_at");

CREATE TABLE "tbk_bookings" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "program_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "customer_party_id" TEXT NOT NULL,
  "traveler_ids" JSONB NOT NULL,
  "status" TEXT NOT NULL,
  "pending_command_key" TEXT,
  "financial_evidence" JSONB,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tbk_bookings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tbk_bookings_id_company_id_branch_id_key" ON "tbk_bookings"("id","company_id","branch_id");
CREATE UNIQUE INDEX "tbk_bookings_company_id_branch_id_code_key" ON "tbk_bookings"("company_id","branch_id","code");
CREATE INDEX "tbk_bookings_company_id_branch_id_program_id_status_idx" ON "tbk_bookings"("company_id","branch_id","program_id","status");
CREATE INDEX "tbk_bookings_company_id_branch_id_customer_id_status_idx" ON "tbk_bookings"("company_id","branch_id","customer_id","status");

CREATE TABLE "tbk_booking_history" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tbk_booking_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tbk_booking_history_company_id_branch_id_booking_id_occurred_at_idx" ON "tbk_booking_history"("company_id","branch_id","booking_id","occurred_at");

WITH "closure_permissions"("id","name") AS (
  VALUES
    ('2eb87db8-535e-42dd-8dc5-6d8af4fb2101','accounting.finance.read'),
    ('2eb87db8-535e-42dd-8dc5-6d8af4fb2102','accounting.finance.operate'),
    ('2eb87db8-535e-42dd-8dc5-6d8af4fb2201','tourism.programs.view'),
    ('2eb87db8-535e-42dd-8dc5-6d8af4fb2202','tourism.programs.manage'),
    ('2eb87db8-535e-42dd-8dc5-6d8af4fb2203','tourism.programs.lifecycle'),
    ('2eb87db8-535e-42dd-8dc5-6d8af4fb2301','tourism.itineraries.view'),
    ('2eb87db8-535e-42dd-8dc5-6d8af4fb2302','tourism.itineraries.manage'),
    ('2eb87db8-535e-42dd-8dc5-6d8af4fb2401','tourism.bookings.view'),
    ('2eb87db8-535e-42dd-8dc5-6d8af4fb2402','tourism.bookings.manage'),
    ('2eb87db8-535e-42dd-8dc5-6d8af4fb2403','tourism.bookings.confirm'),
    ('2eb87db8-535e-42dd-8dc5-6d8af4fb2404','tourism.bookings.cancel')
)
INSERT INTO "pc_permissions" ("id","name")
SELECT "id","name" FROM "closure_permissions"
ON CONFLICT ("name") DO UPDATE SET "name"=EXCLUDED."name";

WITH "permission_names"("name") AS (
  VALUES
    ('accounting.finance.read'),('accounting.finance.operate'),
    ('tourism.programs.view'),('tourism.programs.manage'),('tourism.programs.lifecycle'),
    ('tourism.itineraries.view'),('tourism.itineraries.manage'),
    ('tourism.bookings.view'),('tourism.bookings.manage'),('tourism.bookings.confirm'),('tourism.bookings.cancel')
)
INSERT INTO "pc_company_role_permissions" ("company_id","role_id","permission_id")
SELECT DISTINCT ur."company_id",role."id",permission."id"
FROM "pc_user_roles" ur
JOIN "pc_roles" role ON role."id"=ur."role_id"
JOIN "pc_permissions" permission ON permission."name" IN (SELECT "name" FROM "permission_names")
WHERE role."name"='company-administrator'
ON CONFLICT ("company_id","role_id","permission_id") DO NOTHING;
