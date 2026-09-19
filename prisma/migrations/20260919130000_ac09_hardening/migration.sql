-- AlterTable
ALTER TABLE "af_assets" ADD COLUMN     "capitalization_offset_account_id" TEXT NOT NULL,
ALTER COLUMN "capitalization_journal_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "af_asset_disposals" ADD COLUMN     "proceeds_clearing_account_id" TEXT,
ADD COLUMN     "proceeds_mode" TEXT NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL,
ADD COLUMN     "treasury_id" TEXT,
ADD COLUMN     "treasury_voucher_id" TEXT,
ALTER COLUMN "journal_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "af_loans" DROP COLUMN "funding_account_id",
DROP COLUMN "origination_journal_id",
ADD COLUMN     "base_currency" TEXT NOT NULL,
ADD COLUMN     "funding_treasury_id" TEXT NOT NULL,
ADD COLUMN     "origination_treasury_voucher_id" TEXT;

-- AlterTable
ALTER TABLE "af_provisions" ADD COLUMN     "release_account_id" TEXT NOT NULL,
ADD COLUMN     "request_hash" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "af_provision_movements" ADD COLUMN     "offset_account_id" TEXT NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL,
ALTER COLUMN "journal_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "af_allowances" ADD COLUMN     "release_account_id" TEXT NOT NULL,
ADD COLUMN     "request_hash" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "af_allowance_movements" ADD COLUMN     "status" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "af_allowance_writeoffs" ADD COLUMN     "failure_reason" TEXT;

-- AlterTable
ALTER TABLE "af_payroll_runs" ADD COLUMN     "currency" TEXT NOT NULL;


-- AC-09 strong local financial invariants.
ALTER TABLE "af_assets" ADD CONSTRAINT "af_assets_values_check" CHECK ("base_value" > 0 AND "residual_value" >= 0 AND "accumulated_depreciation" >= 0 AND "accumulated_depreciation" <= "base_value" - "residual_value"), ADD CONSTRAINT "af_assets_status_check" CHECK ("status" IN ('REGISTERING','ACTIVE','DISPOSING','DISPOSED'));
ALTER TABLE "af_asset_depreciations" ADD CONSTRAINT "af_asset_depreciations_amount_check" CHECK ("amount" > 0), ADD CONSTRAINT "af_asset_depreciations_status_check" CHECK ("status" IN ('POSTING','POSTED'));
ALTER TABLE "af_asset_disposals" ADD CONSTRAINT "af_asset_disposals_proceeds_check" CHECK ("proceeds" >= 0), ADD CONSTRAINT "af_asset_disposals_status_check" CHECK ("status" IN ('RESERVED','EFFECTS_POSTED','COMPLETED'));
ALTER TABLE "af_loans" ADD CONSTRAINT "af_loans_amounts_check" CHECK ("principal" > 0 AND "base_amount" > 0 AND "outstanding_principal" >= 0 AND "outstanding_principal" <= "principal"), ADD CONSTRAINT "af_loans_status_check" CHECK ("status" IN ('ORIGINATING','ORIGINATED','COMPLETED'));
ALTER TABLE "af_loan_installments" ADD CONSTRAINT "af_loan_installments_amounts_check" CHECK ("principal" > 0 AND "interest" >= 0), ADD CONSTRAINT "af_loan_installments_status_check" CHECK ("status" IN ('DUE','PAYING','PAID'));
ALTER TABLE "af_provisions" ADD CONSTRAINT "af_provisions_available_check" CHECK ("available" >= 0);
ALTER TABLE "af_provision_movements" ADD CONSTRAINT "af_provision_movements_amount_check" CHECK ("amount" > 0), ADD CONSTRAINT "af_provision_movements_status_check" CHECK ("status" IN ('RESERVED','POSTED'));
ALTER TABLE "af_allowances" ADD CONSTRAINT "af_allowances_amounts_check" CHECK ("amount" > 0 AND "used" >= 0 AND "available" >= 0 AND "used" + "available" <= "amount");
ALTER TABLE "af_allowance_movements" ADD CONSTRAINT "af_allowance_movements_amount_check" CHECK ("amount" > 0), ADD CONSTRAINT "af_allowance_movements_status_check" CHECK ("status" IN ('RESERVED','POSTED'));
ALTER TABLE "af_allowance_writeoffs" ADD CONSTRAINT "af_allowance_writeoffs_amount_check" CHECK ("amount" > 0), ADD CONSTRAINT "af_allowance_writeoffs_status_check" CHECK ("status" IN ('RESERVED','PROCESSING','COMPLETED','RELEASED'));
ALTER TABLE "af_payroll_runs" ADD CONSTRAINT "af_payroll_runs_amount_check" CHECK ("expense_total" > 0), ADD CONSTRAINT "af_payroll_runs_status_check" CHECK ("status" IN ('ACCRUING','ACCRUED','PAYING','PAID'));
ALTER TABLE "af_payroll_liabilities" ADD CONSTRAINT "af_payroll_liabilities_amount_check" CHECK ("amount" > 0);
