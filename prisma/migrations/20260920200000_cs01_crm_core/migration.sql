-- CS-01 CRM Core — additive, forward-only migration.

CREATE TABLE "pr_parties" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "legal_name" TEXT,
  "phone" TEXT,
  "phone_normalized" TEXT,
  "whatsapp_number" TEXT,
  "whatsapp_normalized" TEXT,
  "email" TEXT,
  "email_normalized" TEXT,
  "address" TEXT,
  "national_identity" TEXT,
  "national_identity_normalized" TEXT,
  "tax_identity" TEXT,
  "tax_identity_normalized" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pr_parties_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pr_parties_company_id_id_key" ON "pr_parties"("company_id","id");
CREATE UNIQUE INDEX "pr_parties_company_id_national_identity_normalized_key" ON "pr_parties"("company_id","national_identity_normalized");
CREATE UNIQUE INDEX "pr_parties_company_id_tax_identity_normalized_key" ON "pr_parties"("company_id","tax_identity_normalized");
CREATE INDEX "pr_parties_company_id_phone_normalized_idx" ON "pr_parties"("company_id","phone_normalized");
CREATE INDEX "pr_parties_company_id_email_normalized_idx" ON "pr_parties"("company_id","email_normalized");
CREATE INDEX "pr_parties_company_id_display_name_idx" ON "pr_parties"("company_id","display_name");

CREATE TABLE "pr_party_roles" (
  "company_id" TEXT NOT NULL,
  "party_id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pr_party_roles_pkey" PRIMARY KEY ("company_id","party_id","role"),
  CONSTRAINT "pr_party_roles_company_id_party_id_fkey" FOREIGN KEY ("company_id","party_id") REFERENCES "pr_parties"("company_id","id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "am_agents" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "party_id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "commission_kind" TEXT NOT NULL,
  "commission_value" DECIMAL(24,6) NOT NULL,
  "commission_currency" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "am_agents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "am_agents_company_id_id_key" ON "am_agents"("company_id","id");
CREATE UNIQUE INDEX "am_agents_company_id_party_id_key" ON "am_agents"("company_id","party_id");
CREATE UNIQUE INDEX "am_agents_company_id_number_key" ON "am_agents"("company_id","number");
CREATE INDEX "am_agents_company_id_status_idx" ON "am_agents"("company_id","status");

CREATE TABLE "am_agent_references" (
  "company_id" TEXT NOT NULL,
  "agent_id" TEXT NOT NULL,
  "source_type" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "am_agent_references_pkey" PRIMARY KEY ("company_id","agent_id","source_type","source_id"),
  CONSTRAINT "am_agent_references_company_id_agent_id_fkey" FOREIGN KEY ("company_id","agent_id") REFERENCES "am_agents"("company_id","id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "am_agent_references_company_id_source_type_source_id_idx" ON "am_agent_references"("company_id","source_type","source_id");

CREATE TABLE "am_number_counters" (
  "company_id" TEXT NOT NULL,
  "next_value" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "am_number_counters_pkey" PRIMARY KEY ("company_id")
);

CREATE TABLE "cm_customers" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "party_id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "assigned_agent_id" TEXT,
  "commercial_notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cm_customers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cm_customers_company_id_id_key" ON "cm_customers"("company_id","id");
CREATE UNIQUE INDEX "cm_customers_company_id_party_id_key" ON "cm_customers"("company_id","party_id");
CREATE UNIQUE INDEX "cm_customers_company_id_number_key" ON "cm_customers"("company_id","number");
CREATE INDEX "cm_customers_company_id_status_idx" ON "cm_customers"("company_id","status");
CREATE INDEX "cm_customers_company_id_assigned_agent_id_idx" ON "cm_customers"("company_id","assigned_agent_id");

CREATE TABLE "cm_customer_references" (
  "company_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "source_type" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cm_customer_references_pkey" PRIMARY KEY ("company_id","customer_id","source_type","source_id"),
  CONSTRAINT "cm_customer_references_company_id_customer_id_fkey" FOREIGN KEY ("company_id","customer_id") REFERENCES "cm_customers"("company_id","id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "cm_customer_references_company_id_source_type_source_id_idx" ON "cm_customer_references"("company_id","source_type","source_id");

CREATE TABLE "cm_number_counters" (
  "company_id" TEXT NOT NULL,
  "next_value" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "cm_number_counters_pkey" PRIMARY KEY ("company_id")
);

CREATE TABLE "cl_leads" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "party_kind" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "legal_name" TEXT,
  "phone" TEXT,
  "whatsapp_number" TEXT,
  "email" TEXT,
  "address" TEXT,
  "national_identity" TEXT,
  "tax_identity" TEXT,
  "source" TEXT NOT NULL,
  "requested_service" TEXT,
  "expected_value" DECIMAL(24,6),
  "currency" TEXT,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "responsible_user_id" TEXT,
  "referral_agent_id" TEXT,
  "notes" TEXT,
  "lost_reason" TEXT,
  "pre_lost_status" TEXT,
  "quotation_reference" TEXT,
  "converted_customer_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cl_leads_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cl_leads_company_id_branch_id_id_key" ON "cl_leads"("company_id","branch_id","id");
CREATE UNIQUE INDEX "cl_leads_company_id_branch_id_number_key" ON "cl_leads"("company_id","branch_id","number");
CREATE INDEX "cl_leads_company_id_branch_id_status_updated_at_idx" ON "cl_leads"("company_id","branch_id","status","updated_at");
CREATE INDEX "cl_leads_company_id_branch_id_responsible_user_id_status_idx" ON "cl_leads"("company_id","branch_id","responsible_user_id","status");
CREATE INDEX "cl_leads_company_id_branch_id_phone_idx" ON "cl_leads"("company_id","branch_id","phone");
CREATE INDEX "cl_leads_company_id_branch_id_email_idx" ON "cl_leads"("company_id","branch_id","email");
CREATE INDEX "cl_leads_company_id_converted_customer_id_idx" ON "cl_leads"("company_id","converted_customer_id");

CREATE TABLE "cl_lead_history" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "lead_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "from_status" TEXT,
  "to_status" TEXT,
  "detail" TEXT,
  "actor_id" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cl_lead_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cl_lead_history_company_id_branch_id_lead_id_fkey" FOREIGN KEY ("company_id","branch_id","lead_id") REFERENCES "cl_leads"("company_id","branch_id","id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "cl_lead_history_company_id_branch_id_lead_id_occurred_at_idx" ON "cl_lead_history"("company_id","branch_id","lead_id","occurred_at");

CREATE TABLE "cl_number_counters" (
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "next_value" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "cl_number_counters_pkey" PRIMARY KEY ("company_id","branch_id")
);

CREATE TABLE "cf_followups" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "lead_id" TEXT NOT NULL,
  "responsible_user_id" TEXT NOT NULL,
  "interaction_type" TEXT NOT NULL,
  "scheduled_at" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "outcome" TEXT,
  "next_action" TEXT,
  "previous_followup_id" TEXT,
  "completed_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "completion_voided_at" TIMESTAMP(3),
  "completion_void_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cf_followups_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cf_followups_company_id_branch_id_id_key" ON "cf_followups"("company_id","branch_id","id");
CREATE INDEX "cf_followups_company_id_branch_id_status_scheduled_at_idx" ON "cf_followups"("company_id","branch_id","status","scheduled_at");
CREATE INDEX "cf_followups_company_id_branch_id_responsible_user_id_status_scheduled_at_idx" ON "cf_followups"("company_id","branch_id","responsible_user_id","status","scheduled_at");
CREATE INDEX "cf_followups_company_id_branch_id_lead_id_scheduled_at_idx" ON "cf_followups"("company_id","branch_id","lead_id","scheduled_at");

CREATE TABLE "cf_followup_history" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "followup_id" TEXT NOT NULL,
  "lead_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "detail" TEXT,
  "previous_scheduled_at" TIMESTAMP(3),
  "scheduled_at" TIMESTAMP(3),
  "actor_id" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cf_followup_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cf_followup_history_company_id_branch_id_followup_id_fkey" FOREIGN KEY ("company_id","branch_id","followup_id") REFERENCES "cf_followups"("company_id","branch_id","id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "cf_followup_history_company_id_branch_id_followup_id_occurred_at_idx" ON "cf_followup_history"("company_id","branch_id","followup_id","occurred_at");
CREATE INDEX "cf_followup_history_company_id_branch_id_lead_id_occurred_at_idx" ON "cf_followup_history"("company_id","branch_id","lead_id","occurred_at");
