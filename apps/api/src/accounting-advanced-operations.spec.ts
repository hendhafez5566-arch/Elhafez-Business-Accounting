import test from 'node:test';
import assert from 'node:assert/strict';
import { accruePayrollOp, disposeAssetOp, payPayrollOp, prepareRevaluationOp } from './accounting-advanced-operations.js';

const stableId = (c: string, k: string, key: string) => `${c}|${k}|${key}`;
const capture = <T>(calls: T[]) => async (input: T): Promise<never> => {
  calls.push(input);
  return undefined as never;
};

test('revaluation delegates exact Money/classification input to FX owner using context company', async () => {
  const calls: Record<string, unknown>[] = [];
  await prepareRevaluationOp(
    { prepareRevaluation: capture(calls) } as never,
    'c1' as never,
    {
      positionReference: 'AR-1', classification: 'ASSET', monetary: true,
      foreignAmount: { amount: '125.123456789012345678', currency: 'USD' },
      priorBaseAmount: '6000.25', baseCurrency: 'EGP', at: '2026-12-31T23:59:59.999Z', companyId: 'evil'
    },
  );
  assert.equal(calls[0]!.companyId, 'c1');
  assert.deepEqual(calls[0]!.foreignAmount, { amount: '125.123456789012345678', currency: 'USD' });
});

test('revaluation rejects invalid classification/incomplete input before owner call', () => {
  const calls: Record<string, unknown>[] = [];
  const service = { prepareRevaluation: capture(calls) } as never;
  assert.throws(() => prepareRevaluationOp(service, 'c1' as never, { positionReference: 'x' }));
  assert.throws(() => prepareRevaluationOp(service, 'c1' as never, {
    positionReference: 'x', classification: 'OTHER', monetary: true,
    foreignAmount: { amount: '1', currency: 'USD' }, priorBaseAmount: '1', baseCurrency: 'EGP', at: '2026-12-31T00:00:00.000Z'
  }));
  assert.equal(calls.length, 0);
});

test('asset disposal is retry-safe and passes required clearing account for treasury proceeds', async () => {
  const calls: Record<string, unknown>[] = [];
  const service = { disposeAsset: capture(calls) } as never;
  const body = {
    commandKey: 'k', assetId: 'a1', postingDate: '2026-06-01', proceeds: '100.00',
    proceedsMode: 'TREASURY', treasuryId: 't1', proceedsClearingAccountId: 'clearing', number: 'D1'
  };
  await disposeAssetOp(service, stableId, 'c1' as never, body);
  await disposeAssetOp(service, stableId, 'c1' as never, body);
  assert.equal(calls[0]!.id, calls[1]!.id);
  assert.equal(calls[0]!.companyId, 'c1');
  assert.equal(calls[0]!.proceedsClearingAccountId, 'clearing');
  assert.throws(() => disposeAssetOp(service, stableId, 'c1' as never, { ...body, treasuryId: undefined }));
});

test('payroll accrual validates exact liabilities and generates deterministic ids', async () => {
  const calls: Record<string, unknown>[] = [];
  const service = { accruePayroll: capture(calls) } as never;
  const body = {
    commandKey: 'k', sourceId: 's', payrollPeriod: '2026-01', postingDate: '2026-01-31', currency: 'EGP',
    expenseTotal: '500.00', expenseAccountId: 'e', liabilities: [{ accountId: 'payable', amount: '500', label: 'صافي الرواتب' }], number: 'P1'
  };
  await accruePayrollOp(service, stableId, 'c1' as never, body);
  assert.equal(calls[0]!.id, 'c1|PAYROLL_ACCRUAL|k');
  const liabilities = calls[0]!.liabilities as { id: string; accountId: string; amount: string; label: string }[];
  assert.deepEqual(liabilities[0], { id: 'c1|PAYROLL_ACCRUAL|k|LIABILITY|1', accountId: 'payable', amount: '500', label: 'صافي الرواتب' });
  assert.throws(() => accruePayrollOp(service, stableId, 'c1' as never, { ...body, liabilities: [] }));
});

test('payroll payment passes only evidenced fields with company from context', async () => {
  const calls: Record<string, unknown>[] = [];
  await payPayrollOp({ payPayroll: capture(calls) } as never, 'c1' as never, {
    runId: 'payroll-1', treasuryId: 'bank', postingDate: '2026-02-01', number: 'PP1', companyId: 'evil'
  });
  assert.deepEqual(calls[0], { companyId: 'c1', runId: 'payroll-1', treasuryId: 'bank', postingDate: '2026-02-01', number: 'PP1' });
});
