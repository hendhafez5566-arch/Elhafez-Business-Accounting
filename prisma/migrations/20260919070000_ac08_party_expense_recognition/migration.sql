-- CreateTable
CREATE TABLE "party_accounting_groups" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "party_accounting_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "party_accounting_group_members" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,

    CONSTRAINT "party_accounting_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "party_netting_documents" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "customer_invoice_id" TEXT NOT NULL,
    "supplier_invoice_id" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "posting_date" DATE NOT NULL,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "requester_actor_id" TEXT NOT NULL,
    "approval_request_id" TEXT,
    "customer_allocation_id" TEXT,
    "supplier_allocation_id" TEXT,
    "journal_id" TEXT,
    "reversal_journal_id" TEXT,
    "failure_reason" TEXT,
    "reversed_at" TIMESTAMP(3),

    CONSTRAINT "party_netting_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "party_netting_lines" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,

    CONSTRAINT "party_netting_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "party_netting_allocation_refs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "allocation_id" TEXT NOT NULL,
    "reversed_at" TIMESTAMP(3),

    CONSTRAINT "party_netting_allocation_refs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecr_expenses" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "form" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "base_amount" DECIMAL(38,18) NOT NULL,
    "status" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "billing_invoice_id" TEXT,
    "treasury_voucher_id" TEXT,
    "journal_id" TEXT,
    "approval_request_id" TEXT,
    "expense_account_id" TEXT,
    "prepaid_account_id" TEXT,

    CONSTRAINT "ecr_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecr_recognition_schedules" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "source_invoice_id" TEXT,
    "currency" TEXT NOT NULL,
    "source_amount" DECIMAL(38,18) NOT NULL,
    "base_amount" DECIMAL(38,18) NOT NULL,
    "deferred_account_id" TEXT NOT NULL,
    "recognition_account_id" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "initial_journal_id" TEXT,

    CONSTRAINT "ecr_recognition_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecr_recognition_parts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "service_date" DATE NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "status" TEXT NOT NULL,
    "journal_id" TEXT,
    "reversal_journal_id" TEXT,

    CONSTRAINT "ecr_recognition_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecr_commission_claims" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "agent_party_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "base_carrying_amount" DECIMAL(38,18) NOT NULL,
    "status" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "approval_request_id" TEXT,
    "requester_actor_id" TEXT,
    "recognition_journal_id" TEXT,
    "reversal_journal_id" TEXT,
    "expense_account_id" TEXT NOT NULL,
    "liability_account_id" TEXT NOT NULL,

    CONSTRAINT "ecr_commission_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecr_commission_payments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "claim_id" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "payment_currency" TEXT NOT NULL,
    "settlement_base_amount" DECIMAL(38,18) NOT NULL,
    "carrying_base_amount" DECIMAL(38,18) NOT NULL,
    "realized_fx" DECIMAL(38,18) NOT NULL,
    "fx_rate_id" TEXT,
    "treasury_voucher_id" TEXT,

    CONSTRAINT "ecr_commission_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecr_accruals" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "service_date" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "journal_id" TEXT NOT NULL,
    "accrued_revenue_account_id" TEXT NOT NULL,
    "revenue_account_id" TEXT NOT NULL,
    "billing_invoice_id" TEXT,
    "clearing_journal_id" TEXT,

    CONSTRAINT "ecr_accruals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "party_accounting_groups_company_id_id_key" ON "party_accounting_groups"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "party_accounting_group_members_company_id_group_id_role_par_key" ON "party_accounting_group_members"("company_id", "group_id", "role", "party_id");

-- CreateIndex
CREATE UNIQUE INDEX "party_netting_documents_company_id_id_key" ON "party_netting_documents"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "party_netting_documents_company_id_number_key" ON "party_netting_documents"("company_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "party_netting_lines_company_id_document_id_role_key" ON "party_netting_lines"("company_id", "document_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "party_netting_allocation_refs_company_id_allocation_id_key" ON "party_netting_allocation_refs"("company_id", "allocation_id");

-- CreateIndex
CREATE UNIQUE INDEX "ecr_expenses_company_id_id_key" ON "ecr_expenses"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ecr_expenses_company_id_source_type_source_id_key" ON "ecr_expenses"("company_id", "source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "ecr_recognition_schedules_company_id_id_key" ON "ecr_recognition_schedules"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ecr_recognition_schedules_company_id_source_type_source_id__key" ON "ecr_recognition_schedules"("company_id", "source_type", "source_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ecr_recognition_schedules_company_id_source_invoice_id_kind_key" ON "ecr_recognition_schedules"("company_id", "source_invoice_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ecr_recognition_parts_company_id_schedule_id_service_date_i_key" ON "ecr_recognition_parts"("company_id", "schedule_id", "service_date", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ecr_commission_claims_company_id_id_key" ON "ecr_commission_claims"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ecr_commission_claims_company_id_source_type_source_id_key" ON "ecr_commission_claims"("company_id", "source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "ecr_commission_payments_company_id_id_key" ON "ecr_commission_payments"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ecr_commission_payments_company_id_treasury_voucher_id_key" ON "ecr_commission_payments"("company_id", "treasury_voucher_id");

-- CreateIndex
CREATE UNIQUE INDEX "ecr_accruals_company_id_id_key" ON "ecr_accruals"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ecr_accruals_company_id_source_type_source_id_key" ON "ecr_accruals"("company_id", "source_type", "source_id");

-- AddForeignKey
ALTER TABLE "party_accounting_group_members" ADD CONSTRAINT "party_accounting_group_members_company_id_group_id_fkey" FOREIGN KEY ("company_id", "group_id") REFERENCES "party_accounting_groups"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_netting_documents" ADD CONSTRAINT "party_netting_documents_company_id_group_id_fkey" FOREIGN KEY ("company_id", "group_id") REFERENCES "party_accounting_groups"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_netting_lines" ADD CONSTRAINT "party_netting_lines_company_id_document_id_fkey" FOREIGN KEY ("company_id", "document_id") REFERENCES "party_netting_documents"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_netting_allocation_refs" ADD CONSTRAINT "party_netting_allocation_refs_company_id_document_id_fkey" FOREIGN KEY ("company_id", "document_id") REFERENCES "party_netting_documents"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecr_recognition_parts" ADD CONSTRAINT "ecr_recognition_parts_company_id_schedule_id_fkey" FOREIGN KEY ("company_id", "schedule_id") REFERENCES "ecr_recognition_schedules"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecr_commission_payments" ADD CONSTRAINT "ecr_commission_payments_company_id_claim_id_fkey" FOREIGN KEY ("company_id", "claim_id") REFERENCES "ecr_commission_claims"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AC-08 monetary invariants.
ALTER TABLE "party_netting_documents" ADD CONSTRAINT "party_netting_documents_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "party_netting_lines" ADD CONSTRAINT "party_netting_lines_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "ecr_expenses" ADD CONSTRAINT "ecr_expenses_amounts_positive" CHECK ("amount" > 0 AND "base_amount" > 0);
ALTER TABLE "ecr_recognition_schedules" ADD CONSTRAINT "ecr_recognition_schedule_amounts_positive" CHECK ("source_amount" > 0 AND "base_amount" > 0);
ALTER TABLE "ecr_recognition_parts" ADD CONSTRAINT "ecr_recognition_parts_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "ecr_commission_claims" ADD CONSTRAINT "ecr_commission_claims_amounts_positive" CHECK ("amount" > 0 AND "base_carrying_amount" > 0);
ALTER TABLE "ecr_commission_payments" ADD CONSTRAINT "ecr_commission_payments_amounts_positive" CHECK ("amount" > 0 AND "settlement_base_amount" > 0 AND "carrying_base_amount" > 0);
ALTER TABLE "ecr_accruals" ADD CONSTRAINT "ecr_accruals_amount_positive" CHECK ("amount" > 0);
