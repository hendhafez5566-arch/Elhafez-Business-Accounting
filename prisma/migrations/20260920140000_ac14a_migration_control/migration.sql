-- AC-14A: Platform Core migration-control metadata only.
-- Additive migration. Does not touch any accounting-owner table.

CREATE TABLE "pc_migration_runs" (
    "id" TEXT NOT NULL,
    "source_repository" TEXT NOT NULL,
    "source_commit" TEXT NOT NULL,
    "source_version" TEXT NOT NULL,
    "source_sha256" TEXT,
    "target_baseline_sha" TEXT NOT NULL,
    "implementation_version" TEXT NOT NULL,
    "target_company_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "config_snapshot_hash" TEXT NOT NULL,
    "processed_count" INTEGER NOT NULL DEFAULT 0,
    "rejected_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pc_migration_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pc_migration_runs_target_company_id_idx" ON "pc_migration_runs"("target_company_id");

CREATE TABLE "pc_migration_crosswalks" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "source_collection" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "target_owner" TEXT NOT NULL,
    "target_kind" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "source_payload_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pc_migration_crosswalks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pc_mig_xwalk_source_slot_key"
    ON "pc_migration_crosswalks"("run_id", "source_collection", "source_id", "target_owner", "target_kind");

CREATE UNIQUE INDEX "pc_mig_xwalk_target_key"
    ON "pc_migration_crosswalks"("run_id", "target_owner", "target_kind", "target_id");

CREATE TABLE "pc_migration_checkpoints" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "cursor" TEXT,
    "processed_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pc_migration_checkpoints_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pc_migration_checkpoints_run_id_stage_key"
    ON "pc_migration_checkpoints"("run_id", "stage");

CREATE TABLE "pc_migration_issues" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "stage" TEXT,
    "source_collection" TEXT,
    "source_id" TEXT,
    "detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pc_migration_issues_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pc_migration_issues_run_id_idx" ON "pc_migration_issues"("run_id");
CREATE INDEX "pc_migration_issues_run_id_code_idx" ON "pc_migration_issues"("run_id", "code");

CREATE TABLE "pc_migration_equivalence" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "check_key" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'GLOBAL',
    "expected_value" TEXT NOT NULL,
    "actual_value" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detail" TEXT,
    "checked_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pc_migration_equivalence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pc_migration_equivalence_run_id_check_key_scope_key"
    ON "pc_migration_equivalence"("run_id", "check_key", "scope");

ALTER TABLE "pc_migration_crosswalks" ADD CONSTRAINT "pc_migration_crosswalks_run_id_fkey"
    FOREIGN KEY ("run_id") REFERENCES "pc_migration_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pc_migration_checkpoints" ADD CONSTRAINT "pc_migration_checkpoints_run_id_fkey"
    FOREIGN KEY ("run_id") REFERENCES "pc_migration_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pc_migration_issues" ADD CONSTRAINT "pc_migration_issues_run_id_fkey"
    FOREIGN KEY ("run_id") REFERENCES "pc_migration_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pc_migration_equivalence" ADD CONSTRAINT "pc_migration_equivalence_run_id_fkey"
    FOREIGN KEY ("run_id") REFERENCES "pc_migration_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
