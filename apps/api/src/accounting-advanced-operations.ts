import { BadRequestException } from '@nestjs/common';
import { currencyCode, money, type CompanyId } from '@elhafez/contracts';
import { type CurrencyFxApplicationService, type PositionClassification } from '@elhafez/currency-fx';
import { type AssetsFinancingApplicationService, type PayrollLiability } from '@elhafez/assets-financing';
import { optionalText, requiredDecimal, requiredText } from './accounting-input.js';

type StableId = (companyId: string, kind: string, key: string) => string;
const CLASSIFICATIONS = new Set<PositionClassification>(['ASSET', 'LIABILITY', 'REVENUE', 'EXPENSE', 'EQUITY']);

export function prepareRevaluationOp(
  fx: Pick<CurrencyFxApplicationService, 'prepareRevaluation'>,
  companyId: CompanyId,
  body: Record<string, unknown>,
) {
  const classification = requiredText(body.classification, 'classification') as PositionClassification;
  if (!CLASSIFICATIONS.has(classification)) throw new BadRequestException('invalid classification');
  if (typeof body.monetary !== 'boolean') throw new BadRequestException('monetary must be boolean');
  const foreign = (typeof body.foreignAmount === 'object' && body.foreignAmount !== null ? body.foreignAmount : {}) as Record<string, unknown>;
  return fx.prepareRevaluation({
    companyId,
    positionReference: requiredText(body.positionReference, 'positionReference'),
    classification,
    monetary: body.monetary,
    foreignAmount: money(requiredDecimal(foreign.amount, 'foreignAmount.amount'), currencyCode(requiredText(foreign.currency, 'foreignAmount.currency'))),
    priorBaseAmount: requiredDecimal(body.priorBaseAmount, 'priorBaseAmount'),
    baseCurrency: currencyCode(requiredText(body.baseCurrency, 'baseCurrency')),
    at: requiredText(body.at, 'at'),
  });
}

export function disposeAssetOp(
  assets: Pick<AssetsFinancingApplicationService, 'disposeAsset'>,
  stableId: StableId,
  companyId: CompanyId,
  body: Record<string, unknown>,
) {
  const mode = body.proceedsMode;
  if (mode !== 'TREASURY' && mode !== 'NON_CASH') throw new BadRequestException('proceedsMode must be TREASURY or NON_CASH');
  const commandKey = requiredText(body.commandKey, 'commandKey');
  const treasuryId = optionalText(body.treasuryId);
  if (mode === 'TREASURY' && !treasuryId) throw new BadRequestException('treasuryId is required for TREASURY proceeds');
  return assets.disposeAsset({
    id: stableId(companyId, 'ASSET_DISPOSAL', commandKey),
    companyId,
    assetId: requiredText(body.assetId, 'assetId'),
    postingDate: requiredText(body.postingDate, 'postingDate'),
    proceeds: requiredDecimal(body.proceeds, 'proceeds'),
    proceedsMode: mode,
    ...(treasuryId ? { treasuryId } : {}),
    ...(optionalText(body.proceedsClearingAccountId) ? { proceedsClearingAccountId: optionalText(body.proceedsClearingAccountId)! } : {}),
    number: requiredText(body.number, 'number'),
  });
}

export function accruePayrollOp(
  assets: Pick<AssetsFinancingApplicationService, 'accruePayroll'>,
  stableId: StableId,
  companyId: CompanyId,
  body: Record<string, unknown>,
) {
  if (!Array.isArray(body.liabilities) || body.liabilities.length === 0) throw new BadRequestException('liabilities are required');
  const commandKey = requiredText(body.commandKey, 'commandKey');
  const runId = stableId(companyId, 'PAYROLL_ACCRUAL', commandKey);
  const liabilities: PayrollLiability[] = body.liabilities.map((value, index) => {
    const row = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
    return {
      id: optionalText(row.id) ?? stableId(runId, 'LIABILITY', String(index + 1)),
      accountId: requiredText(row.accountId, `liabilities[${index}].accountId`),
      amount: requiredDecimal(row.amount, `liabilities[${index}].amount`),
      label: requiredText(row.label, `liabilities[${index}].label`),
    };
  });
  return assets.accruePayroll({
    id: runId,
    companyId,
    sourceId: requiredText(body.sourceId, 'sourceId'),
    payrollPeriod: requiredText(body.payrollPeriod, 'payrollPeriod'),
    postingDate: requiredText(body.postingDate, 'postingDate'),
    currency: requiredText(body.currency, 'currency'),
    expenseTotal: requiredDecimal(body.expenseTotal, 'expenseTotal'),
    expenseAccountId: requiredText(body.expenseAccountId, 'expenseAccountId'),
    liabilities,
    number: requiredText(body.number, 'number'),
  });
}

export function payPayrollOp(
  assets: Pick<AssetsFinancingApplicationService, 'payPayroll'>,
  companyId: CompanyId,
  body: Record<string, unknown>,
) {
  return assets.payPayroll({
    companyId,
    runId: requiredText(body.runId, 'runId'),
    treasuryId: requiredText(body.treasuryId, 'treasuryId'),
    postingDate: requiredText(body.postingDate, 'postingDate'),
    number: requiredText(body.number, 'number'),
  });
}
