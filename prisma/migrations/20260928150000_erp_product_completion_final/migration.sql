-- ERP Product Completion Final — forward-only schema additions.
ALTER TABLE "cl_leads" ADD COLUMN IF NOT EXISTS "campaign_id" TEXT;
ALTER TABLE "cl_leads" ADD COLUMN IF NOT EXISTS "pipeline_stage" TEXT;
ALTER TABLE "cl_leads" ADD COLUMN IF NOT EXISTS "score" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "cl_leads" ADD COLUMN IF NOT EXISTS "tags" JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "cl_leads" ADD COLUMN IF NOT EXISTS "sla_due_at" TIMESTAMP(3);

CREATE TABLE "cl_lead_configuration"(
 "company_id" TEXT NOT NULL,"branch_id" TEXT NOT NULL,"sources" JSONB NOT NULL DEFAULT '[]'::jsonb,"campaigns" JSONB NOT NULL DEFAULT '[]'::jsonb,
 "pipeline_stages" JSONB NOT NULL DEFAULT '[]'::jsonb,"assignment_rules" JSONB NOT NULL DEFAULT '[]'::jsonb,"scoring_rules" JSONB NOT NULL DEFAULT '[]'::jsonb,
 "contact_sla_minutes" INTEGER NOT NULL DEFAULT 0,"updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "cl_lead_configuration_pkey" PRIMARY KEY("company_id","branch_id")
);

CREATE TABLE "cm_customer_commercial_profiles"(
 "company_id" TEXT NOT NULL,"customer_id" TEXT NOT NULL,"group_code" TEXT,"loyalty_tier" TEXT,"loyalty_points" INTEGER NOT NULL DEFAULT 0,
 "tags" JSONB NOT NULL DEFAULT '[]'::jsonb,"credit_notes" TEXT,"updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "cm_customer_commercial_profiles_pkey" PRIMARY KEY("company_id","customer_id")
);
CREATE INDEX "cm_customer_commercial_profiles_company_id_group_code_idx" ON "cm_customer_commercial_profiles"("company_id","group_code");

CREATE TABLE "qt_templates"(
 "id" TEXT NOT NULL,"company_id" TEXT NOT NULL,"branch_id" TEXT NOT NULL,"code" TEXT NOT NULL,"name" TEXT NOT NULL,"currency" TEXT NOT NULL,
 "default_validity_days" INTEGER NOT NULL,"terms" TEXT,"notes" TEXT,"lines" JSONB NOT NULL,"active" BOOLEAN NOT NULL DEFAULT true,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "qt_templates_pkey" PRIMARY KEY("id")
);
CREATE UNIQUE INDEX "qt_templates_company_id_branch_id_id_key" ON "qt_templates"("company_id","branch_id","id");
CREATE UNIQUE INDEX "qt_templates_company_id_branch_id_code_key" ON "qt_templates"("company_id","branch_id","code");
CREATE INDEX "qt_templates_company_id_branch_id_active_idx" ON "qt_templates"("company_id","branch_id","active");

CREATE TABLE "tpr_program_commercial"(
 "company_id" TEXT NOT NULL,"branch_id" TEXT NOT NULL,"program_id" TEXT NOT NULL,"total_capacity" INTEGER,"waitlist_enabled" BOOLEAN NOT NULL DEFAULT false,
 "price_tiers" JSONB NOT NULL DEFAULT '[]'::jsonb,"add_on_service_ids" JSONB NOT NULL DEFAULT '[]'::jsonb,"discount_policy" JSONB NOT NULL DEFAULT '{}'::jsonb,
 "updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "tpr_program_commercial_pkey" PRIMARY KEY("company_id","branch_id","program_id")
);

CREATE TABLE "tbk_booking_extensions"(
 "company_id" TEXT NOT NULL,"branch_id" TEXT NOT NULL,"booking_id" TEXT NOT NULL,"sales_state" TEXT NOT NULL DEFAULT 'BOOKED',
 "price_tier_code" TEXT,"special_requests" TEXT,"voucher_number" TEXT,"travel_pack_issued_at" TIMESTAMP(3),"updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "tbk_booking_extensions_pkey" PRIMARY KEY("company_id","branch_id","booking_id")
);
CREATE INDEX "tbk_booking_extensions_company_id_branch_id_sales_state_idx" ON "tbk_booking_extensions"("company_id","branch_id","sales_state");

CREATE TABLE "tbk_booking_amendments"(
 "id" TEXT NOT NULL,"company_id" TEXT NOT NULL,"branch_id" TEXT NOT NULL,"booking_id" TEXT NOT NULL,"kind" TEXT NOT NULL,"reason" TEXT NOT NULL,
 "detail" TEXT NOT NULL,"finance_reference" TEXT,"actor_id" TEXT NOT NULL,"occurred_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "tbk_booking_amendments_pkey" PRIMARY KEY("id")
);
CREATE INDEX "tbk_booking_amendments_company_id_branch_id_booking_id_occurred_at_idx" ON "tbk_booking_amendments"("company_id","branch_id","booking_id","occurred_at");

CREATE TABLE "tbk_payment_plan_items"(
 "id" TEXT NOT NULL,"company_id" TEXT NOT NULL,"branch_id" TEXT NOT NULL,"booking_id" TEXT NOT NULL,"due_date" DATE NOT NULL,
 "amount" DECIMAL(24,6) NOT NULL,"status" TEXT NOT NULL DEFAULT 'PLANNED',"evidence_reference" TEXT,"updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "tbk_payment_plan_items_pkey" PRIMARY KEY("id")
);
CREATE INDEX "tbk_payment_plan_items_company_id_branch_id_booking_id_due_date_idx" ON "tbk_payment_plan_items"("company_id","branch_id","booking_id","due_date");

CREATE TABLE "cs_number_counters"("company_id" TEXT NOT NULL,"branch_id" TEXT NOT NULL,"next_value" INTEGER NOT NULL DEFAULT 0,CONSTRAINT "cs_number_counters_pkey" PRIMARY KEY("company_id","branch_id"));
CREATE TABLE "cs_service_cases"(
 "id" TEXT NOT NULL,"company_id" TEXT NOT NULL,"branch_id" TEXT NOT NULL,"number" TEXT NOT NULL,"customer_id" TEXT NOT NULL,"category" TEXT NOT NULL,
 "priority" TEXT NOT NULL,"subject" TEXT NOT NULL,"description" TEXT NOT NULL,"status" TEXT NOT NULL,"assignee_user_id" TEXT,"sla_due_at" TIMESTAMP(3),
 "resolved_at" TIMESTAMP(3),"closed_at" TIMESTAMP(3),"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "cs_service_cases_pkey" PRIMARY KEY("id")
);
CREATE UNIQUE INDEX "cs_service_cases_company_id_branch_id_id_key" ON "cs_service_cases"("company_id","branch_id","id");
CREATE UNIQUE INDEX "cs_service_cases_company_id_branch_id_number_key" ON "cs_service_cases"("company_id","branch_id","number");
CREATE INDEX "cs_service_cases_company_id_branch_id_status_updated_at_idx" ON "cs_service_cases"("company_id","branch_id","status","updated_at");
CREATE INDEX "cs_service_cases_company_id_branch_id_customer_id_idx" ON "cs_service_cases"("company_id","branch_id","customer_id");
CREATE TABLE "cs_case_notes"(
 "id" TEXT NOT NULL,"company_id" TEXT NOT NULL,"branch_id" TEXT NOT NULL,"case_id" TEXT NOT NULL,"author_id" TEXT NOT NULL,"visibility" TEXT NOT NULL,"body" TEXT NOT NULL,"created_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "cs_case_notes_pkey" PRIMARY KEY("id")
);
CREATE INDEX "cs_case_notes_company_id_branch_id_case_id_created_at_idx" ON "cs_case_notes"("company_id","branch_id","case_id","created_at");
CREATE TABLE "cs_case_history"(
 "id" TEXT NOT NULL,"company_id" TEXT NOT NULL,"branch_id" TEXT NOT NULL,"case_id" TEXT NOT NULL,"action" TEXT NOT NULL,"actor_id" TEXT NOT NULL,"detail" TEXT,"occurred_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "cs_case_history_pkey" PRIMARY KEY("id")
);
CREATE INDEX "cs_case_history_company_id_branch_id_case_id_occurred_at_idx" ON "cs_case_history"("company_id","branch_id","case_id","occurred_at");

CREATE TABLE "dm_document_requirements"(
 "id" TEXT NOT NULL,"company_id" TEXT NOT NULL,"entity_type" TEXT NOT NULL,"document_type" TEXT NOT NULL,"label" TEXT NOT NULL,"required" BOOLEAN NOT NULL,
 "expiry_required" BOOLEAN NOT NULL,"warning_days" INTEGER NOT NULL DEFAULT 30,"active" BOOLEAN NOT NULL DEFAULT true,
 CONSTRAINT "dm_document_requirements_pkey" PRIMARY KEY("id")
);
CREATE UNIQUE INDEX "dm_document_requirements_company_id_entity_type_document_type_key" ON "dm_document_requirements"("company_id","entity_type","document_type");
CREATE TABLE "dm_business_documents"(
 "id" TEXT NOT NULL,"company_id" TEXT NOT NULL,"entity_type" TEXT NOT NULL,"entity_id" TEXT NOT NULL,"document_type" TEXT NOT NULL,"title" TEXT NOT NULL,
 "owner_user_id" TEXT,"issue_date" DATE,"expiry_date" DATE,"tags" JSONB NOT NULL DEFAULT '[]'::jsonb,"required" BOOLEAN NOT NULL DEFAULT false,
 "current_version" INTEGER NOT NULL DEFAULT 1,"status" TEXT NOT NULL DEFAULT 'ACTIVE',"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "dm_business_documents_pkey" PRIMARY KEY("id")
);
CREATE UNIQUE INDEX "dm_business_documents_company_id_id_key" ON "dm_business_documents"("company_id","id");
CREATE INDEX "dm_business_documents_company_id_entity_type_entity_id_idx" ON "dm_business_documents"("company_id","entity_type","entity_id");
CREATE INDEX "dm_business_documents_company_id_expiry_date_status_idx" ON "dm_business_documents"("company_id","expiry_date","status");
CREATE TABLE "dm_document_versions"(
 "id" TEXT NOT NULL,"company_id" TEXT NOT NULL,"document_id" TEXT NOT NULL,"version" INTEGER NOT NULL,"file_id" TEXT NOT NULL,"note" TEXT,"actor_id" TEXT NOT NULL,"created_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "dm_document_versions_pkey" PRIMARY KEY("id")
);
CREATE UNIQUE INDEX "dm_document_versions_company_id_document_id_version_key" ON "dm_document_versions"("company_id","document_id","version");
CREATE INDEX "dm_document_versions_company_id_file_id_idx" ON "dm_document_versions"("company_id","file_id");

CREATE TABLE "ccc_collection_policies"(
 "id" TEXT NOT NULL,"company_id" TEXT NOT NULL,"reminder_days_before_due" INTEGER NOT NULL,"collector_days_overdue" INTEGER NOT NULL,
 "supervisor_days_overdue" INTEGER NOT NULL,"credit_hold_days_overdue" INTEGER NOT NULL,"legal_days_overdue" INTEGER NOT NULL,"active" BOOLEAN NOT NULL DEFAULT true,
 CONSTRAINT "ccc_collection_policies_pkey" PRIMARY KEY("id")
);
CREATE UNIQUE INDEX "ccc_collection_policies_company_id_key" ON "ccc_collection_policies"("company_id");
CREATE TABLE "ccc_collection_cases"(
 "id" TEXT NOT NULL,"company_id" TEXT NOT NULL,"branch_id" TEXT NOT NULL,"invoice_id" TEXT NOT NULL,"customer_party_id" TEXT NOT NULL,"currency" TEXT NOT NULL,
 "due_date" DATE,"collector_user_id" TEXT,"status" TEXT NOT NULL,"stage" TEXT NOT NULL,"opened_at" TIMESTAMP(3) NOT NULL,"resolved_at" TIMESTAMP(3),
 "last_outstanding" DECIMAL(24,6) NOT NULL,"last_refreshed_at" TIMESTAMP(3) NOT NULL,"dispute_reason" TEXT,
 CONSTRAINT "ccc_collection_cases_pkey" PRIMARY KEY("id")
);
CREATE UNIQUE INDEX "ccc_collection_cases_company_id_branch_id_id_key" ON "ccc_collection_cases"("company_id","branch_id","id");
CREATE INDEX "ccc_collection_cases_company_id_branch_id_invoice_id_idx" ON "ccc_collection_cases"("company_id","branch_id","invoice_id");
CREATE INDEX "ccc_collection_cases_company_id_branch_id_status_stage_idx" ON "ccc_collection_cases"("company_id","branch_id","status","stage");
CREATE TABLE "ccc_promises_to_pay"(
 "id" TEXT NOT NULL,"company_id" TEXT NOT NULL,"branch_id" TEXT NOT NULL,"case_id" TEXT NOT NULL,"promised_date" DATE NOT NULL,"amount" DECIMAL(24,6) NOT NULL,
 "status" TEXT NOT NULL,"note" TEXT,"actor_id" TEXT NOT NULL,"created_at" TIMESTAMP(3) NOT NULL,"resolved_at" TIMESTAMP(3),
 CONSTRAINT "ccc_promises_to_pay_pkey" PRIMARY KEY("id")
);
CREATE INDEX "ccc_promises_to_pay_company_id_branch_id_case_id_status_idx" ON "ccc_promises_to_pay"("company_id","branch_id","case_id","status");
CREATE TABLE "ccc_collection_activities"(
 "id" TEXT NOT NULL,"company_id" TEXT NOT NULL,"branch_id" TEXT NOT NULL,"case_id" TEXT NOT NULL,"kind" TEXT NOT NULL,"detail" TEXT NOT NULL,"actor_id" TEXT NOT NULL,"occurred_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ccc_collection_activities_pkey" PRIMARY KEY("id")
);
CREATE INDEX "ccc_collection_activities_company_id_branch_id_case_id_occurred_at_idx" ON "ccc_collection_activities"("company_id","branch_id","case_id","occurred_at");

CREATE TABLE "ih_connections"(
 "id" TEXT NOT NULL,"company_id" TEXT NOT NULL,"kind" TEXT NOT NULL,"name" TEXT NOT NULL,"enabled" BOOLEAN NOT NULL DEFAULT true,"endpoint" TEXT,"credential_ref" TEXT,
 "config" JSONB NOT NULL DEFAULT '{}'::jsonb,"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ih_connections_pkey" PRIMARY KEY("id")
);
CREATE UNIQUE INDEX "ih_connections_company_id_id_key" ON "ih_connections"("company_id","id");
CREATE INDEX "ih_connections_company_id_kind_enabled_idx" ON "ih_connections"("company_id","kind","enabled");
CREATE TABLE "ih_api_keys"(
 "id" TEXT NOT NULL,"company_id" TEXT NOT NULL,"actor_user_id" TEXT NOT NULL,"name" TEXT NOT NULL,"key_prefix" TEXT NOT NULL,"secret_hash" TEXT NOT NULL,"scopes" JSONB NOT NULL DEFAULT '[]'::jsonb,
 "rate_limit_per_minute" INTEGER NOT NULL DEFAULT 60,"window_started_at" TIMESTAMP(3) NOT NULL,"window_count" INTEGER NOT NULL DEFAULT 0,
 "expires_at" TIMESTAMP(3),"revoked_at" TIMESTAMP(3),"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ih_api_keys_pkey" PRIMARY KEY("id")
);
CREATE UNIQUE INDEX "ih_api_keys_secret_hash_key" ON "ih_api_keys"("secret_hash");
CREATE INDEX "ih_api_keys_company_id_revoked_at_idx" ON "ih_api_keys"("company_id","revoked_at");
CREATE TABLE "ih_webhook_subscriptions"(
 "id" TEXT NOT NULL,"company_id" TEXT NOT NULL,"event" TEXT NOT NULL,"url" TEXT NOT NULL,"secret_ref" TEXT,"active" BOOLEAN NOT NULL DEFAULT true,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ih_webhook_subscriptions_pkey" PRIMARY KEY("id")
);
CREATE UNIQUE INDEX "ih_webhook_subscriptions_company_id_id_key" ON "ih_webhook_subscriptions"("company_id","id");
CREATE INDEX "ih_webhook_subscriptions_company_id_event_active_idx" ON "ih_webhook_subscriptions"("company_id","event","active");
CREATE TABLE "ih_webhook_deliveries"(
 "id" TEXT NOT NULL,"company_id" TEXT NOT NULL,"subscription_id" TEXT NOT NULL,"event" TEXT NOT NULL,"payload" JSONB NOT NULL,"status" TEXT NOT NULL,
 "attempt" INTEGER NOT NULL DEFAULT 0,"max_attempts" INTEGER NOT NULL DEFAULT 5,"next_attempt_at" TIMESTAMP(3) NOT NULL,"response_code" INTEGER,"last_error" TEXT,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ih_webhook_deliveries_pkey" PRIMARY KEY("id")
);
CREATE INDEX "ih_webhook_deliveries_company_id_subscription_id_created_at_idx" ON "ih_webhook_deliveries"("company_id","subscription_id","created_at");
CREATE INDEX "ih_webhook_deliveries_status_next_attempt_at_idx" ON "ih_webhook_deliveries"("status","next_attempt_at");

CREATE TABLE "cc_templates"(
 "id" TEXT NOT NULL,"company_id" TEXT NOT NULL,"code" TEXT NOT NULL,"channel" TEXT NOT NULL,"language" TEXT NOT NULL,"subject" TEXT,"body" TEXT NOT NULL,
 "active" BOOLEAN NOT NULL DEFAULT true,"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "cc_templates_pkey" PRIMARY KEY("id")
);
CREATE UNIQUE INDEX "cc_templates_company_id_code_channel_language_key" ON "cc_templates"("company_id","code","channel","language");
CREATE TABLE "cc_preferences"(
 "company_id" TEXT NOT NULL,"user_id" TEXT NOT NULL,"channel" TEXT NOT NULL,"enabled" BOOLEAN NOT NULL DEFAULT true,"updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "cc_preferences_pkey" PRIMARY KEY("company_id","user_id","channel")
);
CREATE TABLE "cc_deliveries"(
 "id" TEXT NOT NULL,"company_id" TEXT NOT NULL,"branch_id" TEXT,"template_id" TEXT,"channel" TEXT NOT NULL,"user_id" TEXT,"recipient" TEXT NOT NULL,
 "language" TEXT NOT NULL,"variables" JSONB NOT NULL DEFAULT '{}'::jsonb,"subject" TEXT,"body" TEXT NOT NULL,"status" TEXT NOT NULL,
 "scheduled_at" TIMESTAMP(3) NOT NULL,"attempt" INTEGER NOT NULL DEFAULT 0,"max_attempts" INTEGER NOT NULL DEFAULT 5,"provider_reference" TEXT,"last_error" TEXT,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "cc_deliveries_pkey" PRIMARY KEY("id")
);
CREATE INDEX "cc_deliveries_company_id_status_scheduled_at_idx" ON "cc_deliveries"("company_id","status","scheduled_at");
CREATE INDEX "cc_deliveries_company_id_user_id_created_at_idx" ON "cc_deliveries"("company_id","user_id","created_at");

CREATE TABLE "hubc_barcode_requests"(
 "id" TEXT NOT NULL,"company_id" TEXT NOT NULL,"branch_id" TEXT NOT NULL,"booking_id" TEXT NOT NULL,"traveler_id" TEXT NOT NULL,"passport_document_id" TEXT NOT NULL,
 "status" TEXT NOT NULL,"external_reference" TEXT,"barcode_value" TEXT,"rejection_reason" TEXT,"attempt" INTEGER NOT NULL DEFAULT 0,"submitted_at" TIMESTAMP(3),
 "issued_at" TIMESTAMP(3),"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "hubc_barcode_requests_pkey" PRIMARY KEY("id")
);
CREATE UNIQUE INDEX "hubc_barcode_requests_company_id_branch_id_id_key" ON "hubc_barcode_requests"("company_id","branch_id","id");
CREATE INDEX "hubc_barcode_requests_company_id_branch_id_booking_id_traveler_id_idx" ON "hubc_barcode_requests"("company_id","branch_id","booking_id","traveler_id");
CREATE INDEX "hubc_barcode_requests_company_id_branch_id_status_idx" ON "hubc_barcode_requests"("company_id","branch_id","status");
CREATE TABLE "hubc_barcode_history"(
 "id" TEXT NOT NULL,"company_id" TEXT NOT NULL,"branch_id" TEXT NOT NULL,"request_id" TEXT NOT NULL,"action" TEXT NOT NULL,"from_status" TEXT,"to_status" TEXT NOT NULL,
 "detail" TEXT,"actor_id" TEXT NOT NULL,"occurred_at" TIMESTAMP(3) NOT NULL,CONSTRAINT "hubc_barcode_history_pkey" PRIMARY KEY("id")
);
CREATE INDEX "hubc_barcode_history_company_id_branch_id_request_id_occurred_at_idx" ON "hubc_barcode_history"("company_id","branch_id","request_id","occurred_at");

CREATE TABLE "hr_employees"(
 "id" TEXT NOT NULL,"company_id" TEXT NOT NULL,"branch_id" TEXT NOT NULL,"employee_number" TEXT NOT NULL,"display_name" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'ACTIVE',
 "hire_date" DATE NOT NULL,"termination_date" DATE,"department" TEXT,"cost_center_id" TEXT,"currency" TEXT NOT NULL,"base_salary" DECIMAL(24,6) NOT NULL,
 "net_payable_account_id" TEXT NOT NULL,"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "hr_employees_pkey" PRIMARY KEY("id")
);
CREATE UNIQUE INDEX "hr_employees_company_id_branch_id_id_key" ON "hr_employees"("company_id","branch_id","id");
CREATE UNIQUE INDEX "hr_employees_company_id_branch_id_employee_number_key" ON "hr_employees"("company_id","branch_id","employee_number");
CREATE INDEX "hr_employees_company_id_branch_id_status_idx" ON "hr_employees"("company_id","branch_id","status");
CREATE TABLE "hr_attendance"(
 "id" TEXT NOT NULL,"company_id" TEXT NOT NULL,"branch_id" TEXT NOT NULL,"employee_id" TEXT NOT NULL,"work_date" DATE NOT NULL,"status" TEXT NOT NULL,
 "worked_minutes" INTEGER NOT NULL DEFAULT 0,"overtime_minutes" INTEGER NOT NULL DEFAULT 0,"note" TEXT,CONSTRAINT "hr_attendance_pkey" PRIMARY KEY("id")
);
CREATE UNIQUE INDEX "hr_attendance_company_id_branch_id_employee_id_work_date_key" ON "hr_attendance"("company_id","branch_id","employee_id","work_date");
CREATE INDEX "hr_attendance_company_id_branch_id_work_date_idx" ON "hr_attendance"("company_id","branch_id","work_date");
CREATE TABLE "hr_leave_requests"(
 "id" TEXT NOT NULL,"company_id" TEXT NOT NULL,"branch_id" TEXT NOT NULL,"employee_id" TEXT NOT NULL,"type" TEXT NOT NULL,"start_date" DATE NOT NULL,
 "end_date" DATE NOT NULL,"status" TEXT NOT NULL,"reason" TEXT,"decided_by" TEXT,"decided_at" TIMESTAMP(3),CONSTRAINT "hr_leave_requests_pkey" PRIMARY KEY("id")
);
CREATE INDEX "hr_leave_requests_company_id_branch_id_employee_id_status_idx" ON "hr_leave_requests"("company_id","branch_id","employee_id","status");
CREATE TABLE "hr_pay_components"(
 "id" TEXT NOT NULL,"company_id" TEXT NOT NULL,"branch_id" TEXT NOT NULL,"employee_id" TEXT NOT NULL,"code" TEXT NOT NULL,"kind" TEXT NOT NULL,
 "amount" DECIMAL(24,6) NOT NULL,"liability_account_id" TEXT,"active" BOOLEAN NOT NULL DEFAULT true,CONSTRAINT "hr_pay_components_pkey" PRIMARY KEY("id")
);
CREATE INDEX "hr_pay_components_company_id_branch_id_employee_id_active_idx" ON "hr_pay_components"("company_id","branch_id","employee_id","active");
CREATE TABLE "hr_payroll_runs"(
 "id" TEXT NOT NULL,"company_id" TEXT NOT NULL,"branch_id" TEXT NOT NULL,"period" TEXT NOT NULL,"posting_date" DATE NOT NULL,"currency" TEXT NOT NULL,
 "status" TEXT NOT NULL,"expense_account_id" TEXT NOT NULL,"net_payable_account_id" TEXT NOT NULL,"total_gross" DECIMAL(24,6) NOT NULL,
 "total_deductions" DECIMAL(24,6) NOT NULL,"total_net" DECIMAL(24,6) NOT NULL,"accounting_run_id" TEXT,"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMP(3) NOT NULL,CONSTRAINT "hr_payroll_runs_pkey" PRIMARY KEY("id")
);
CREATE UNIQUE INDEX "hr_payroll_runs_company_id_branch_id_id_key" ON "hr_payroll_runs"("company_id","branch_id","id");
CREATE UNIQUE INDEX "hr_payroll_runs_company_id_branch_id_period_key" ON "hr_payroll_runs"("company_id","branch_id","period");
CREATE INDEX "hr_payroll_runs_company_id_branch_id_status_idx" ON "hr_payroll_runs"("company_id","branch_id","status");
CREATE TABLE "hr_payroll_lines"(
 "id" TEXT NOT NULL,"company_id" TEXT NOT NULL,"branch_id" TEXT NOT NULL,"run_id" TEXT NOT NULL,"employee_id" TEXT NOT NULL,
 "gross" DECIMAL(24,6) NOT NULL,"deductions" DECIMAL(24,6) NOT NULL,"net" DECIMAL(24,6) NOT NULL,"details" JSONB NOT NULL DEFAULT '[]'::jsonb,
 CONSTRAINT "hr_payroll_lines_pkey" PRIMARY KEY("id")
);
CREATE INDEX "hr_payroll_lines_company_id_branch_id_run_id_idx" ON "hr_payroll_lines"("company_id","branch_id","run_id");
CREATE INDEX "hr_payroll_lines_company_id_branch_id_employee_id_idx" ON "hr_payroll_lines"("company_id","branch_id","employee_id");
