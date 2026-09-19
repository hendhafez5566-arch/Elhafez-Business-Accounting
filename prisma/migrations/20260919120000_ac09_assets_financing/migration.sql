-- CreateTable
CREATE TABLE "cba_budgets" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "cost_center_id" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "status" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,

    CONSTRAINT "cba_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cba_budget_actuals" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "cost_center_id" TEXT NOT NULL,
    "posting_date" DATE NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "journal_id" TEXT NOT NULL,
    "journal_line_id" TEXT NOT NULL,

    CONSTRAINT "cba_budget_actuals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "af_assets" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "acquisition_value" DECIMAL(38,18) NOT NULL,
    "base_value" DECIMAL(38,18) NOT NULL,
    "currency" TEXT NOT NULL,
    "acquisition_date" DATE NOT NULL,
    "capitalization_date" DATE NOT NULL,
    "in_service_date" DATE NOT NULL,
    "residual_value" DECIMAL(38,18) NOT NULL,
    "useful_life_months" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "asset_account_id" TEXT NOT NULL,
    "accumulated_depreciation_account_id" TEXT NOT NULL,
    "depreciation_expense_account_id" TEXT NOT NULL,
    "disposal_gain_account_id" TEXT,
    "disposal_loss_account_id" TEXT,
    "status" TEXT NOT NULL,
    "accumulated_depreciation" DECIMAL(38,18) NOT NULL,
    "capitalization_journal_id" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,

    CONSTRAINT "af_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "af_asset_depreciations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "period" INTEGER NOT NULL,
    "posting_date" DATE NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "status" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "journal_id" TEXT,

    CONSTRAINT "af_asset_depreciations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "af_asset_disposals" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "posting_date" DATE NOT NULL,
    "proceeds" DECIMAL(38,18) NOT NULL,
    "request_hash" TEXT NOT NULL,
    "journal_id" TEXT NOT NULL,

    CONSTRAINT "af_asset_disposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "af_loans" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "lender_id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "principal" DECIMAL(38,18) NOT NULL,
    "outstanding_principal" DECIMAL(38,18) NOT NULL,
    "currency" TEXT NOT NULL,
    "base_amount" DECIMAL(38,18) NOT NULL,
    "liability_account_id" TEXT NOT NULL,
    "interest_expense_account_id" TEXT NOT NULL,
    "funding_account_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "origination_journal_id" TEXT NOT NULL,

    CONSTRAINT "af_loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "af_loan_installments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "loan_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "principal" DECIMAL(38,18) NOT NULL,
    "interest" DECIMAL(38,18) NOT NULL,
    "status" TEXT NOT NULL,
    "request_hash" TEXT,
    "treasury_voucher_id" TEXT,
    "journal_id" TEXT,

    CONSTRAINT "af_loan_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "af_provisions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provision_account_id" TEXT NOT NULL,
    "expense_account_id" TEXT NOT NULL,
    "available" DECIMAL(38,18) NOT NULL,

    CONSTRAINT "af_provisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "af_provision_movements" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "provision_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "journal_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "af_provision_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "af_allowances" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "source_reference" TEXT NOT NULL,
    "allowance_account_id" TEXT NOT NULL,
    "expense_account_id" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "used" DECIMAL(38,18) NOT NULL,
    "available" DECIMAL(38,18) NOT NULL,

    CONSTRAINT "af_allowances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "af_allowance_movements" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "allowance_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "source_id" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "journal_id" TEXT,
    "billing_adjustment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "af_allowance_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "af_allowance_writeoffs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "allowance_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "posting_date" DATE NOT NULL,
    "request_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "billing_adjustment_id" TEXT,

    CONSTRAINT "af_allowance_writeoffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "af_payroll_runs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "payroll_period" TEXT NOT NULL,
    "posting_date" DATE NOT NULL,
    "expense_total" DECIMAL(38,18) NOT NULL,
    "expense_account_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "journal_id" TEXT,
    "treasury_voucher_id" TEXT,

    CONSTRAINT "af_payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "af_payroll_liabilities" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "af_payroll_liabilities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cba_budgets_company_id_id_key" ON "cba_budgets"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "cba_budgets_company_id_cost_center_id_period_start_period_e_key" ON "cba_budgets"("company_id", "cost_center_id", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "cba_budget_actuals_company_id_cost_center_id_posting_date_idx" ON "cba_budget_actuals"("company_id", "cost_center_id", "posting_date");

-- CreateIndex
CREATE UNIQUE INDEX "cba_budget_actuals_company_id_id_key" ON "cba_budget_actuals"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "cba_budget_actuals_company_id_journal_id_journal_line_id_key" ON "cba_budget_actuals"("company_id", "journal_id", "journal_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "af_assets_company_id_id_key" ON "af_assets"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "af_assets_company_id_code_key" ON "af_assets"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "af_asset_depreciations_company_id_id_key" ON "af_asset_depreciations"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "af_asset_depreciations_company_id_asset_id_period_key" ON "af_asset_depreciations"("company_id", "asset_id", "period");

-- CreateIndex
CREATE UNIQUE INDEX "af_asset_disposals_company_id_id_key" ON "af_asset_disposals"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "af_asset_disposals_company_id_asset_id_key" ON "af_asset_disposals"("company_id", "asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "af_loans_company_id_id_key" ON "af_loans"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "af_loans_company_id_reference_key" ON "af_loans"("company_id", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "af_loan_installments_company_id_id_key" ON "af_loan_installments"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "af_loan_installments_company_id_loan_id_sequence_key" ON "af_loan_installments"("company_id", "loan_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "af_provisions_company_id_id_key" ON "af_provisions"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "af_provision_movements_company_id_id_key" ON "af_provision_movements"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "af_provision_movements_company_id_source_type_source_id_key" ON "af_provision_movements"("company_id", "source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "af_allowances_company_id_id_key" ON "af_allowances"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "af_allowance_movements_company_id_id_key" ON "af_allowance_movements"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "af_allowance_writeoffs_company_id_id_key" ON "af_allowance_writeoffs"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "af_payroll_runs_company_id_id_key" ON "af_payroll_runs"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "af_payroll_runs_company_id_source_id_key" ON "af_payroll_runs"("company_id", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "af_payroll_liabilities_company_id_id_key" ON "af_payroll_liabilities"("company_id", "id");

-- AddForeignKey
ALTER TABLE "af_asset_depreciations" ADD CONSTRAINT "af_asset_depreciations_company_id_asset_id_fkey" FOREIGN KEY ("company_id", "asset_id") REFERENCES "af_assets"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "af_asset_disposals" ADD CONSTRAINT "af_asset_disposals_company_id_asset_id_fkey" FOREIGN KEY ("company_id", "asset_id") REFERENCES "af_assets"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "af_loan_installments" ADD CONSTRAINT "af_loan_installments_company_id_loan_id_fkey" FOREIGN KEY ("company_id", "loan_id") REFERENCES "af_loans"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "af_provision_movements" ADD CONSTRAINT "af_provision_movements_company_id_provision_id_fkey" FOREIGN KEY ("company_id", "provision_id") REFERENCES "af_provisions"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "af_allowance_movements" ADD CONSTRAINT "af_allowance_movements_company_id_allowance_id_fkey" FOREIGN KEY ("company_id", "allowance_id") REFERENCES "af_allowances"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "af_allowance_writeoffs" ADD CONSTRAINT "af_allowance_writeoffs_company_id_allowance_id_fkey" FOREIGN KEY ("company_id", "allowance_id") REFERENCES "af_allowances"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "af_payroll_liabilities" ADD CONSTRAINT "af_payroll_liabilities_company_id_run_id_fkey" FOREIGN KEY ("company_id", "run_id") REFERENCES "af_payroll_runs"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

