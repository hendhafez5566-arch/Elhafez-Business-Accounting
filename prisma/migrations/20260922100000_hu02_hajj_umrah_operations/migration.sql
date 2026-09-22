ALTER TABLE "tci_allocations" ADD COLUMN "flight_segment_reference" JSONB;

CREATE TABLE "hub_bookings" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "program_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "customer_party_id" TEXT NOT NULL,
  "agent_id" TEXT,
  "agent_party_id" TEXT,
  "traveler_ids" JSONB NOT NULL,
  "status" TEXT NOT NULL,
  "financial_state" TEXT NOT NULL,
  "allocation_ids" JSONB NOT NULL,
  "confirmation_command_key" TEXT,
  "confirmation_payload_hash" TEXT,
  "financial_evidence" JSONB,
  "cancellation_evidence" JSONB,
  "source_reference" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hub_bookings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "hub_bookings_scope_id_key" ON "hub_bookings"("id","company_id","branch_id");
CREATE UNIQUE INDEX "hub_bookings_code_key" ON "hub_bookings"("company_id","branch_id","code");
CREATE UNIQUE INDEX "hub_bookings_confirmation_key" ON "hub_bookings"("company_id","confirmation_command_key");
CREATE INDEX "hub_bookings_program_status_idx" ON "hub_bookings"("company_id","branch_id","program_id","status");
CREATE INDEX "hub_bookings_customer_idx" ON "hub_bookings"("company_id","branch_id","customer_id");

CREATE TABLE "hub_booking_history" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "from_status" TEXT,
  "to_status" TEXT,
  "reason" TEXT,
  "evidence" JSONB,
  "actor_id" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hub_booking_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "hub_booking_history_idx" ON "hub_booking_history"("company_id","branch_id","booking_id","occurred_at");

CREATE TABLE "hur_room_assignments" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "program_id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "traveler_id" TEXT NOT NULL,
  "allocation_id" TEXT NOT NULL,
  "room_key" TEXT NOT NULL,
  "room_label" TEXT,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "status" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hur_room_assignments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "hur_room_assignments_scope_id_key" ON "hur_room_assignments"("id","company_id","branch_id");
CREATE INDEX "hur_room_assignments_program_idx" ON "hur_room_assignments"("company_id","branch_id","program_id","status");
CREATE INDEX "hur_room_assignments_traveler_window_idx" ON "hur_room_assignments"("company_id","branch_id","traveler_id","start_date","end_date","status");
CREATE INDEX "hur_room_assignments_allocation_window_idx" ON "hur_room_assignments"("company_id","branch_id","allocation_id","start_date","end_date","status");

CREATE TABLE "hur_rooming_history" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "assignment_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "actor_id" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hur_rooming_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "hur_rooming_history_idx" ON "hur_rooming_history"("company_id","branch_id","assignment_id","occurred_at");

CREATE TABLE "huv_visa_cases" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "program_id" TEXT NOT NULL,
  "traveler_id" TEXT NOT NULL,
  "passport_document_id" TEXT NOT NULL,
  "allocation_id" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "application_reference" TEXT,
  "visa_number" TEXT,
  "rejection_reason" TEXT,
  "issuance_evidence" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "huv_visa_cases_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "huv_visa_cases_scope_id_key" ON "huv_visa_cases"("id","company_id","branch_id");
CREATE UNIQUE INDEX "huv_visa_cases_identity_key" ON "huv_visa_cases"("company_id","branch_id","booking_id","traveler_id","allocation_id");
CREATE INDEX "huv_visa_cases_program_idx" ON "huv_visa_cases"("company_id","branch_id","program_id","status");
CREATE INDEX "huv_visa_cases_traveler_idx" ON "huv_visa_cases"("company_id","branch_id","traveler_id","status");

CREATE TABLE "huv_visa_history" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "visa_case_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "from_status" TEXT,
  "to_status" TEXT NOT NULL,
  "attempt" INTEGER NOT NULL,
  "evidence" JSONB,
  "actor_id" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "huv_visa_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "huv_visa_history_idx" ON "huv_visa_history"("company_id","branch_id","visa_case_id","occurred_at");

CREATE TABLE "hut_ticket_records" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "program_id" TEXT NOT NULL,
  "traveler_id" TEXT NOT NULL,
  "allocation_id" TEXT NOT NULL,
  "flight_block_id" TEXT NOT NULL,
  "flight_segment_reference" JSONB NOT NULL,
  "pnr" TEXT NOT NULL,
  "ticket_number" TEXT,
  "seat" TEXT,
  "baggage" TEXT,
  "fare_class" TEXT,
  "status" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "issuance_evidence" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hut_ticket_records_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "hut_ticket_records_scope_id_key" ON "hut_ticket_records"("id","company_id","branch_id");
CREATE UNIQUE INDEX "hut_ticket_records_identity_key" ON "hut_ticket_records"("company_id","branch_id","booking_id","traveler_id","allocation_id");
CREATE INDEX "hut_ticket_records_program_idx" ON "hut_ticket_records"("company_id","branch_id","program_id","status");
CREATE INDEX "hut_ticket_records_traveler_idx" ON "hut_ticket_records"("company_id","branch_id","traveler_id","status");
CREATE INDEX "hut_ticket_records_number_idx" ON "hut_ticket_records"("company_id","ticket_number");

CREATE TABLE "hutr_runs" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "program_id" TEXT NOT NULL,
  "allocation_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "route" TEXT NOT NULL,
  "starts_at" TIMESTAMP(3) NOT NULL,
  "ends_at" TIMESTAMP(3) NOT NULL,
  "vehicle_reference" TEXT,
  "driver_reference" TEXT,
  "status" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hutr_runs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "hutr_runs_scope_id_key" ON "hutr_runs"("id","company_id","branch_id");
CREATE UNIQUE INDEX "hutr_runs_code_key" ON "hutr_runs"("company_id","branch_id","code");
CREATE INDEX "hutr_runs_program_idx" ON "hutr_runs"("company_id","branch_id","program_id","status","starts_at");
CREATE INDEX "hutr_runs_allocation_window_idx" ON "hutr_runs"("company_id","branch_id","allocation_id","starts_at","ends_at");

CREATE TABLE "hutr_manifest_assignments" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "traveler_id" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hutr_manifest_assignments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "hutr_manifest_scope_id_key" ON "hutr_manifest_assignments"("id","company_id","branch_id");
CREATE UNIQUE INDEX "hutr_manifest_run_traveler_key" ON "hutr_manifest_assignments"("company_id","branch_id","run_id","traveler_id");
CREATE INDEX "hutr_manifest_traveler_idx" ON "hutr_manifest_assignments"("company_id","branch_id","traveler_id","status");
ALTER TABLE "hutr_manifest_assignments" ADD CONSTRAINT "hutr_manifest_run_fkey" FOREIGN KEY ("run_id","company_id","branch_id") REFERENCES "hutr_runs"("id","company_id","branch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "hutr_history" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "aggregate_type" TEXT NOT NULL,
  "aggregate_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "evidence" JSONB,
  "actor_id" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hutr_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "hutr_history_idx" ON "hutr_history"("company_id","branch_id","aggregate_type","aggregate_id","occurred_at");

CREATE TABLE "huo_tasks" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "program_id" TEXT NOT NULL,
  "booking_id" TEXT,
  "traveler_id" TEXT,
  "title" TEXT NOT NULL,
  "assigned_to" TEXT,
  "due_at" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL,
  "completed_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "huo_tasks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "huo_tasks_scope_id_key" ON "huo_tasks"("id","company_id","branch_id");
CREATE INDEX "huo_tasks_due_idx" ON "huo_tasks"("company_id","branch_id","program_id","status","due_at");
CREATE INDEX "huo_tasks_booking_idx" ON "huo_tasks"("company_id","branch_id","booking_id","status");

CREATE TABLE "huo_incidents" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "program_id" TEXT NOT NULL,
  "booking_id" TEXT,
  "traveler_id" TEXT,
  "severity" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "details" TEXT,
  "status" TEXT NOT NULL,
  "resolved_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "huo_incidents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "huo_incidents_scope_id_key" ON "huo_incidents"("id","company_id","branch_id");
CREATE INDEX "huo_incidents_program_idx" ON "huo_incidents"("company_id","branch_id","program_id","status","severity");
CREATE INDEX "huo_incidents_traveler_idx" ON "huo_incidents"("company_id","branch_id","traveler_id","status");

CREATE TABLE "huo_service_executions" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "program_id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "traveler_id" TEXT,
  "allocation_id" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "executed_at" TIMESTAMP(3) NOT NULL,
  "evidence_reference" JSONB,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "huo_service_executions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "huo_service_executions_scope_id_key" ON "huo_service_executions"("id","company_id","branch_id");
CREATE INDEX "huo_service_executions_program_idx" ON "huo_service_executions"("company_id","branch_id","program_id","category","executed_at");
CREATE INDEX "huo_service_executions_booking_idx" ON "huo_service_executions"("company_id","branch_id","booking_id","traveler_id");

CREATE TABLE "huo_history" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "aggregate_type" TEXT NOT NULL,
  "aggregate_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "evidence" JSONB,
  "actor_id" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "huo_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "huo_history_idx" ON "huo_history"("company_id","branch_id","aggregate_type","aggregate_id","occurred_at");
