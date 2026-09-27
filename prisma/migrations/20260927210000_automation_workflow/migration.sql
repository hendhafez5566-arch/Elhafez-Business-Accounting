CREATE TABLE "aw_workflow_definitions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger_event" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "spec_json" JSONB NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "aw_workflow_definitions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "aw_workflow_definitions_company_id_id_key" ON "aw_workflow_definitions"("company_id","id");
CREATE UNIQUE INDEX "aw_workflow_definitions_company_id_code_key" ON "aw_workflow_definitions"("company_id","code");
CREATE INDEX "aw_workflow_definitions_company_id_trigger_event_status_idx" ON "aw_workflow_definitions"("company_id","trigger_event","status");

CREATE TABLE "aw_workflow_runs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "workflow_id" TEXT NOT NULL,
    "workflow_version" INTEGER NOT NULL,
    "trigger_event" TEXT NOT NULL,
    "correlation_key" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "spec_snapshot_json" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_run_at" TIMESTAMP(3),
    "waiting_signal" TEXT,
    "last_error" TEXT,
    "lease_token" TEXT,
    "lease_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "aw_workflow_runs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "aw_workflow_runs_company_id_id_key" ON "aw_workflow_runs"("company_id","id");
CREATE UNIQUE INDEX "aw_workflow_runs_company_id_workflow_id_correlation_key_key" ON "aw_workflow_runs"("company_id","workflow_id","correlation_key");
CREATE INDEX "aw_workflow_runs_status_next_run_at_lease_expires_at_idx" ON "aw_workflow_runs"("status","next_run_at","lease_expires_at");
CREATE INDEX "aw_workflow_runs_company_id_created_at_idx" ON "aw_workflow_runs"("company_id","created_at");
ALTER TABLE "aw_workflow_runs" ADD CONSTRAINT "aw_workflow_runs_company_id_workflow_id_fkey"
FOREIGN KEY ("company_id","workflow_id") REFERENCES "aw_workflow_definitions"("company_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "aw_workflow_execution_logs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "step_index" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detail_json" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "aw_workflow_execution_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "aw_workflow_execution_logs_company_id_run_id_occurred_at_idx" ON "aw_workflow_execution_logs"("company_id","run_id","occurred_at");
ALTER TABLE "aw_workflow_execution_logs" ADD CONSTRAINT "aw_workflow_execution_logs_company_id_run_id_fkey"
FOREIGN KEY ("company_id","run_id") REFERENCES "aw_workflow_runs"("company_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
