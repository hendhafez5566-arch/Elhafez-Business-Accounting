import assert from 'node:assert/strict';
import test from 'node:test';
import { companyId, decimalAmount, sourceReference } from '@elhafez/contracts';
import type { BillingSubledgersApplicationService } from '@elhafez/billing-subledgers';
import type { TreasurySettlementApplicationService } from '@elhafez/treasury-settlement';
import type { ExpenseCommissionRecognitionApplicationService } from '@elhafez/expense-commission-recognition';
import type { ProcurementFinanceApplicationService } from '@elhafez/procurement-finance';
import type { FinancialControlsApplicationService } from '@elhafez/financial-controls';
import type { CostBudgetAccountingApplicationService } from '@elhafez/cost-budget-accounting';
import type { TourismContractInventoryApplicationService } from '@elhafez/tourism-contract-inventory';
import {
  BillingAdapter,
  CommissionAdapter,
  ControlsAdapter,
  CostAdapter,
  InventoryAdapter,
  ProcurementAdapter,
  TreasuryAdapter,
} from './tourism-finance-orchestration.module.js';

const company = companyId('company-integration');
const program = sourceReference('TOURISM_PROGRAM', 'program-1');
const booking = sourceReference('TOURISM_BOOKING', 'booking-1');
const amount = decimalAmount('125');

const asService = <T>(value: object) => value as unknown as T;

test('real Billing adapter creates and posts a booking invoice through the public application boundary', async () => {
  const calls: Array<{ method: string; value: unknown }> = [];
  const service = asService<BillingSubledgersApplicationService>({
    async createDraft(value: unknown) { calls.push({ method: 'createDraft', value }); return { id: 'invoice-1' }; },
    async postInvoice(companyId: unknown, id: string) { calls.push({ method: 'postInvoice', value: { companyId, id } }); return { id }; },
  });
  const adapter = new BillingAdapter(service);
  const result = await adapter.createBookingInvoice({ id: 'invoice-1', companyId: company, branchId: 'branch-1', partyId: 'customer-1', number: 'INV-1', postingDate: '2026-09-19', dueDate: '2026-09-30', currency: 'EGP', sourceId: booking.sourceId, receivableAccountId: 'ar', revenueAccountId: 'revenue', amount });
  assert.equal(result.id, 'invoice-1');
  assert.deepEqual(calls.map((call) => call.method), ['createDraft', 'postInvoice']);
  assert.deepEqual(calls[0]?.value, { id: 'invoice-1', companyId: company, branchId: 'branch-1', type: 'CUSTOMER', partyId: 'customer-1', number: 'INV-1', postingDate: '2026-09-19', dueDate: '2026-09-30', currency: 'EGP', sourceType: 'TOURISM_BOOKING', sourceId: booking.sourceId, controlAccountId: 'ar', lines: [{ id: 'invoice-1:1', accountId: 'revenue', amount }] });
});

test('real Treasury adapter sends booking deposits to the Billing-aware voucher command', async () => {
  let command: unknown;
  const service = asService<TreasurySettlementApplicationService>({ async postVoucher(value: unknown) { command = value; return { id: 'voucher-1' }; } });
  const result = await new TreasuryAdapter(service).postDeposit({ id: 'voucher-1', companyId: company, branchId: 'branch-1', treasuryId: 'cash', partyId: 'customer-1', invoiceId: 'invoice-1', number: 'R-1', postingDate: '2026-09-19', amount, controlAccountId: 'ar', advanceAccountId: 'advance' });
  assert.equal(result.id, 'voucher-1');
  assert.deepEqual(command, { id: 'voucher-1', companyId: company, branchId: 'branch-1', treasuryId: 'cash', kind: 'RECEIPT', partyKind: 'CUSTOMER', partyId: 'customer-1', number: 'R-1', postingDate: '2026-09-19', amount, sourceType: 'TOURISM_BOOKING_DEPOSIT', sourceId: 'voucher-1', controlAccountId: 'ar', advanceAccountId: 'advance', explicitDraftInvoiceId: 'invoice-1' });
});

test('Treasury reversal and Billing cancellation evidence remain separate owner commands', async () => {
  const calls: string[] = [];
  const treasury = new TreasuryAdapter(asService<TreasurySettlementApplicationService>({ async voidVoucher(_company: unknown, id: string) { calls.push(`void:${id}`); return { id: `void:${id}` }; } }));
  const billing = new BillingAdapter(asService<BillingSubledgersApplicationService>({ async getCancellationEvidence(_company: unknown, id: string) { calls.push(`evidence:${id}`); return { hasHistoricalAllocationEvidence: true, activeAllocationIds: [], hasAvailableAdvance: false, settlementRequired: false, cancellationSafe: true, outstanding: decimalAmount('125') }; } }));
  await treasury.reverseDeposit(company, 'voucher-1', '2026-09-20', 'RV-1');
  const evidence = await billing.cancellationEvidence(company, 'invoice-1');
  assert.deepEqual(calls, ['void:voucher-1', 'evidence:invoice-1']);
  assert.equal(evidence.cancellationSafe, true);
  assert.equal(evidence.hasHistoricalAllocationEvidence, true);
});

test('real ECR adapter delegates commission creation, evidence and reversal', async () => {
  const calls: string[] = [];
  let createCommand: unknown;
  const service = asService<ExpenseCommissionRecognitionApplicationService>({
    async createCommissionClaim(value: unknown) { createCommand = value; calls.push('create'); return { id: 'claim-1' }; },
    async getCommissionCancellationEvidence() { calls.push('evidence'); return { hasPostedPaymentHistory: false, reversible: true }; },
    async reverseUnpaidCommission() { calls.push('reverse'); return { id: 'claim-1' }; },
  });
  const adapter = new CommissionAdapter(service);
  await adapter.create({ id: 'claim-1', companyId: company, branchId: 'branch-1', agentPartyId: 'agent-1', sourceId: booking.sourceId, currency: 'EGP', amount, expenseAccountId: 'commission-expense', liabilityAccountId: 'commission-payable' });
  await adapter.evidence(company, 'claim-1');
  await adapter.reverse(company, 'claim-1', '2026-09-20', 'REV-1');
  assert.deepEqual(calls, ['create', 'evidence', 'reverse']);
  assert.deepEqual(createCommand, { id: 'claim-1', companyId: company, branchId: 'branch-1', agentPartyId: 'agent-1', sourceType: 'TOURISM_BOOKING', sourceId: booking.sourceId, currency: 'EGP', amount, baseCarryingAmount: amount, expenseAccountId: 'commission-expense', liabilityAccountId: 'commission-payable' });
});

test('real Procurement adapter delegates cleanup policy unchanged to the owner command', async () => {
  const reference = { purchaseOrderId: 'po-1' };
  let received: unknown;
  const service = asService<ProcurementFinanceApplicationService>({ async cleanupForProgramCancellation(companyId: unknown, value: unknown) { received = { companyId, value }; return { id: 'po-1', status: 'CANCELLED' }; } });
  const result = await new ProcurementAdapter(service).cleanupForProgramCancellation(company, reference);
  assert.deepEqual(received, { companyId: company, value: reference });
  assert.deepEqual(result, { id: 'po-1', status: 'CANCELLED' });
});

test('real Financial Controls adapter validates exact BOOKING_DISCOUNT approval evidence', async () => {
  const service = asService<FinancialControlsApplicationService>({
    async evaluateApprovalRequirement() { return { decision: 'APPROVAL_REQUIRED' }; },
    async getApprovalRequest() { return { action: 'BOOKING_DISCOUNT', sourceType: booking.sourceType, sourceId: booking.sourceId, amount, branchId: 'branch-1' }; },
    async getApprovalDecision() { return { outcome: 'APPROVED' }; },
  });
  const adapter = new ControlsAdapter(service);
  await adapter.authorizeDiscount({ companyId: company, branchId: 'branch-1', booking, amount, approvalRequestId: 'approval-1' });
  assert.equal(await adapter.approvalResolved(company, 'approval-1'), true);
});

test('real Cost adapter uses semantic program association and actualization commands', async () => {
  const calls: string[] = [];
  const service = asService<CostBudgetAccountingApplicationService>({
    async ensureProgramCostCenter(_company: unknown, _program: unknown, id: string) { calls.push('ensure'); return { costCenterId: id }; },
    async resolveProgramCostCenter() { calls.push('resolve'); return { id: 'cc-1' }; },
    async recordTourismServiceActualization(value: { id: string }) { calls.push('actualize'); return { id: value.id }; },
  });
  const adapter = new CostAdapter(service);
  assert.deepEqual(await adapter.ensureProgram(company, program, 'cc-1'), { costCenterId: 'cc-1' });
  assert.deepEqual(await adapter.resolveProgram(company, program), { costCenterId: 'cc-1' });
  assert.deepEqual(await adapter.actualize({ id: 'cost-1', companyId: company, program, service: sourceReference('TOURISM_SERVICE', 'service-1'), evidence: sourceReference('FLIGHT_SEGMENT', 'segment-1'), amount, postingDate: '2026-09-19' }), { id: 'cost-1' });
  assert.deepEqual(calls, ['ensure', 'resolve', 'actualize']);
});

test('real Tourism Contract Inventory adapter delegates allocation and release through its public boundary', async () => {
  const calls: Array<{ method: string; value: unknown; key: string }> = [];
  const service = asService<TourismContractInventoryApplicationService>({
    async allocateCapacity(value: unknown, key: string) { calls.push({ method: 'allocate', value, key }); return { allocation: { id: 'allocation-1' } }; },
    async releaseAllocation(value: unknown, key: string) { calls.push({ method: 'release', value, key }); return { success: true }; },
  });
  const adapter = new InventoryAdapter(service);
  const allocation = await adapter.allocate({ companyId: company, allocationId: 'allocation-1', contractId: 'contract-1', resourceType: 'HOTEL', resourceId: 'room-1', program, serviceDate: '2026-10-01', quantity: decimalAmount('2') }, 'allocate-key');
  const release = await adapter.release(company, 'allocation-1', decimalAmount('2'), 'release-key');
  assert.deepEqual(allocation, { allocationId: 'allocation-1', procurementReference: undefined });
  assert.deepEqual(release, { success: true });
  assert.deepEqual(calls.map((call) => [call.method, call.key]), [['allocate', 'allocate-key'], ['release', 'release-key']]);
});
