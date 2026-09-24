CREATE TABLE "tci_standalone_supply_plans" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "service_type" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "input_hash" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "snapshot" JSONB NOT NULL,
    "requests" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "committed" JSONB,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tci_standalone_supply_plans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tci_standalone_supply_plans_company_id_branch_id_service_type_service_id_status_idx"
ON "tci_standalone_supply_plans"("company_id", "branch_id", "service_type", "service_id", "status");

CREATE TABLE "ss_service_types" (
  "id" TEXT NOT NULL, "company_id" TEXT NOT NULL, "code" TEXT NOT NULL,
  "category" TEXT NOT NULL, "name_ar" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "ss_service_types_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ss_service_types_company_id_id_key" ON "ss_service_types"("company_id", "id");
CREATE UNIQUE INDEX "ss_service_types_company_id_code_key" ON "ss_service_types"("company_id", "code");

CREATE TABLE "ss_services" (
  "id" TEXT NOT NULL, "company_id" TEXT NOT NULL, "branch_id" TEXT NOT NULL,
  "number" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'DRAFT', "revision" INTEGER NOT NULL DEFAULT 1,
  "confirmed_revision" INTEGER, "external_operation_id" TEXT, "pending_command_key" TEXT, "cancellation_posting_date" TEXT,
  "supply_plan_id" TEXT, "supply_plan_version" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ss_services_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ss_services_company_id_id_key" ON "ss_services"("company_id", "id");
CREATE UNIQUE INDEX "ss_services_company_id_branch_id_number_key" ON "ss_services"("company_id", "branch_id", "number");
CREATE INDEX "ss_services_company_id_branch_id_status_updated_at_idx" ON "ss_services"("company_id", "branch_id", "status", "updated_at");

CREATE TABLE "ss_service_revisions" (
  "service_id" TEXT NOT NULL, "revision" INTEGER NOT NULL, "service_type_id" TEXT NOT NULL,
  "category" TEXT NOT NULL, "service_date" TEXT NOT NULL, "period_end" TEXT,
  "quantity" DECIMAL(38,18) NOT NULL, "debtor_kind" TEXT NOT NULL, "debtor_party_id" TEXT NOT NULL,
  "customer_party_id" TEXT NOT NULL, "beneficiary_party_ids" JSONB NOT NULL,
  "details" JSONB NOT NULL, "commercial" JSONB NOT NULL, "financial_terms" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ss_service_revisions_pkey" PRIMARY KEY ("service_id", "revision")
);

CREATE TABLE "ss_service_history" (
  "id" TEXT NOT NULL, "service_id" TEXT NOT NULL, "revision" INTEGER NOT NULL,
  "kind" TEXT NOT NULL, "actor_id" TEXT NOT NULL, "evidence" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ss_service_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ss_service_history_service_id_created_at_idx" ON "ss_service_history"("service_id", "created_at");

CREATE TABLE "ss_command_receipts" (
  "company_id" TEXT NOT NULL, "command_key" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL, "result" JSONB NOT NULL,
  CONSTRAINT "ss_command_receipts_pkey" PRIMARY KEY ("company_id", "command_key")
);

CREATE TABLE "tfo_standalone_service_references" (
  "id" TEXT NOT NULL, "company_id" TEXT NOT NULL, "branch_id" TEXT NOT NULL,
  "service_type" TEXT NOT NULL, "service_id" TEXT NOT NULL, "revision" INTEGER NOT NULL,
  "confirmation_payload_hash" TEXT NOT NULL, "confirmation_workflow_id" TEXT NOT NULL,
  "status" TEXT NOT NULL, "debtor_party_id" TEXT NOT NULL, "invoice_id" TEXT,
  "allocation_ids" JSONB NOT NULL, "purchase_order_ids" JSONB NOT NULL, "commission_claim_id" TEXT, "financial_setup" JSONB NOT NULL,
  CONSTRAINT "tfo_standalone_service_references_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tfo_standalone_service_references_company_id_service_type_service_id_key"
ON "tfo_standalone_service_references"("company_id", "service_type", "service_id");

CREATE TABLE "sf_cases" (
 "id" TEXT PRIMARY KEY, "company_id" TEXT NOT NULL, "branch_id" TEXT NOT NULL, "service_id" TEXT NOT NULL, "revision" INTEGER NOT NULL,
 "quantity" DECIMAL(38,18) NOT NULL, "status" TEXT NOT NULL, "supplier_id" TEXT, "internal_coverage" BOOLEAN NOT NULL DEFAULT false,
 "confirmed_quantity" DECIMAL(38,18) NOT NULL DEFAULT 0, "delivered_quantity" DECIMAL(38,18) NOT NULL DEFAULT 0, "version" INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX "sf_cases_company_id_branch_id_service_id_key" ON "sf_cases"("company_id","branch_id","service_id");
CREATE TABLE "sf_confirmations" ("id" TEXT PRIMARY KEY,"case_id" TEXT NOT NULL,"actor_id" TEXT NOT NULL,"at" TIMESTAMP(3) NOT NULL,"quantity" DECIMAL(38,18) NOT NULL,"supplier_id" TEXT,"reference_type" TEXT NOT NULL,"reference" TEXT NOT NULL,"file_id" TEXT,"internal_coverage" BOOLEAN NOT NULL DEFAULT false);
CREATE INDEX "sf_confirmations_case_id_at_idx" ON "sf_confirmations"("case_id","at");
CREATE TABLE "sf_delivery_evidence" ("id" TEXT PRIMARY KEY,"case_id" TEXT NOT NULL,"actor_id" TEXT NOT NULL,"at" TIMESTAMP(3) NOT NULL,"quantity" DECIMAL(38,18) NOT NULL,"unit" TEXT NOT NULL,"note" TEXT NOT NULL,"file_id" TEXT,"corrects_id" TEXT);
CREATE INDEX "sf_delivery_evidence_case_id_at_idx" ON "sf_delivery_evidence"("case_id","at");
CREATE TABLE "sf_command_receipts" ("company_id" TEXT NOT NULL,"command_key" TEXT NOT NULL,"payload_hash" TEXT NOT NULL,"case_id" TEXT NOT NULL,PRIMARY KEY ("company_id","command_key"));
CREATE TABLE "sv_vouchers" ("id" TEXT PRIMARY KEY,"company_id" TEXT NOT NULL,"branch_id" TEXT NOT NULL,"service_id" TEXT NOT NULL,"number" TEXT NOT NULL,"status" TEXT NOT NULL,"version" INTEGER NOT NULL DEFAULT 1);
CREATE UNIQUE INDEX "sv_vouchers_company_id_branch_id_number_key" ON "sv_vouchers"("company_id","branch_id","number");
CREATE INDEX "sv_vouchers_company_id_branch_id_service_id_idx" ON "sv_vouchers"("company_id","branch_id","service_id");
CREATE TABLE "sv_voucher_versions" ("voucher_id" TEXT NOT NULL,"version" INTEGER NOT NULL,"snapshot" JSONB NOT NULL,"status" TEXT NOT NULL,PRIMARY KEY ("voucher_id","version"));
CREATE TABLE "sv_command_receipts" ("company_id" TEXT NOT NULL,"command_key" TEXT NOT NULL,"payload_hash" TEXT NOT NULL,"voucher_id" TEXT NOT NULL,PRIMARY KEY ("company_id","command_key"));

-- Provision the service workspace capabilities only for existing company administrators.
-- Other roles receive them through the standard company-scoped permission workflow.
WITH "service_permissions" AS (
  INSERT INTO "pc_permissions" ("id", "name") VALUES
    ('ea1d3a80-c4ab-4e6a-8295-000000000001', 'tourism.services.view'),
    ('ea1d3a80-c4ab-4e6a-8295-000000000002', 'tourism.services.manage'),
    ('ea1d3a80-c4ab-4e6a-8295-000000000003', 'tourism.services.confirm'),
    ('ea1d3a80-c4ab-4e6a-8295-000000000004', 'tourism.services.cancel'),
    ('ea1d3a80-c4ab-4e6a-8295-000000000005', 'tourism.services.fulfill'),
    ('ea1d3a80-c4ab-4e6a-8295-000000000006', 'tourism.services.voucher')
  ON CONFLICT ("name") DO UPDATE SET "name" = EXCLUDED."name"
  RETURNING "id"
)
INSERT INTO "pc_company_role_permissions" ("company_id", "role_id", "permission_id")
SELECT DISTINCT ur."company_id", role."id", permission."id"
FROM "pc_user_roles" ur
JOIN "pc_roles" role ON role."id" = ur."role_id"
CROSS JOIN "service_permissions" permission
WHERE role."name" = 'company-administrator'
ON CONFLICT ("company_id", "role_id", "permission_id") DO NOTHING;
