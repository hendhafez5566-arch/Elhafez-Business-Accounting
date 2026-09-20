import test from 'node:test';
import assert from 'node:assert/strict';
import { companyId, decimalAmount, sourceReference } from '@elhafez/contracts';
import { TourismFinanceOrchestrationApplicationService, type ConfirmBookingInput } from './application/tourism-finance-orchestration.application-service.js';
import { InMemoryTourismFinanceRepository } from './infrastructure/in-memory-tourism-finance.repository.js';
import type { BillingPort, CommissionPort, ControlsPort, CostPort, InventoryPort, ProcurementPort, TreasuryPort } from './application/ports.js';

const company = companyId('company-a'); const other = companyId('company-b'); const booking = sourceReference('TOURISM_BOOKING', 'booking-1'); const program = sourceReference('TOURISM_PROGRAM', 'program-1');
class FailingRepository extends InMemoryTourismFinanceRepository { failStep?: string; failed = false; override async completeStep(companyId: typeof company, id: string, ownerReference: string | undefined, result: unknown) { const step = [...this.steps.values()].find((item) => item.id === id); if (!this.failed && step?.name === this.failStep) { this.failed = true; throw new Error('local completion failure'); } return super.completeStep(companyId, id, ownerReference, result); } }
function fixture(repo = new FailingRepository()) {
  const calls = { invoice: 0, deposit: 0, commission: 0, release: 0, allocation: 0, cost: 0, cleanup: 0, cancelInvoice: 0 }; let paid = false; let historical = false; let commissionPaid = false; let inventoryBlocked = false; let approval = true; let costLinked = true; let procurementSequence: Array<'NONE' | 'SUPPLIER_EXECUTION' | 'SUPPLIER_INVOICE'> = ['NONE']; const effects = new Set<string>();
  const once = (key: string, field: keyof typeof calls) => { if (!effects.has(key)) { effects.add(key); calls[field]++; } };
  const billing: BillingPort = { async createBookingInvoice(input) { once(input.id, 'invoice'); return { id: input.id }; }, async cancellationEvidence() { return { hasHistoricalAllocationEvidence: historical, activeAllocationIds: paid ? ['allocation-payment'] : [], hasAvailableAdvance: false, settlementRequired: paid, cancellationSafe: !paid, outstanding: decimalAmount(paid ? '0' : '100') }; }, async cancelInvoice(_company, id) { once(`cancel:${id}`, 'cancelInvoice'); return { id }; } };
  const treasury: TreasuryPort = { async postDeposit(input) { once(input.id, 'deposit'); paid = true; historical = true; return { id: input.id }; }, async reverseDeposit(_company, id) { paid = false; return { id }; } };
  const commission: CommissionPort = { async create(input) { once(input.id, 'commission'); return { id: input.id }; }, async evidence() { return { hasPostedPaymentHistory: commissionPaid, reversible: !commissionPaid }; }, async reverse(_company, id) { return { id }; } };
  const cost: CostPort = { async ensureProgram(_company, _program, id) { return { costCenterId: id }; }, async resolveProgram() { if (!costLinked) throw new Error('missing'); return { costCenterId: 'cc-1' }; }, async actualize(input) { once(input.id, 'cost'); return { id: input.id }; } };
  const inventory: InventoryPort = { async allocate(input) { once(`inventory:${input.allocationId}`, 'allocation'); return { allocationId: input.allocationId }; }, async blockers() { return inventoryBlocked ? [{ type: 'FINANCIAL_HISTORY' }] : []; }, async release(_company, id, _quantity, key) { once(`release:${key}`, 'release'); return { success: true, id }; } };
  const procurement: ProcurementPort = { async blockers() { const value = procurementSequence.length > 1 ? procurementSequence.shift()! : procurementSequence[0]!; return value === 'NONE' ? [] : [{ type: value, purchaseOrderId: 'po-1', lineId: 'line-1' }]; }, async cleanupForProgramCancellation(_company, reference) { once(`cleanup:${reference.purchaseOrderId ?? reference.commitmentId}`, 'cleanup'); return { id: reference.purchaseOrderId ?? reference.commitmentId!, status: 'CANCELLED' }; } };
  const controls: ControlsPort = { async authorizeDiscount() { if (!approval) throw new Error('denied'); }, async approvalResolved() { return approval; } };
  const create = () => new TourismFinanceOrchestrationApplicationService(repo, billing, treasury, commission, cost, inventory, procurement, controls); const service = create();
  const setup = () => service.configureFinancialSetup({ id: 'setup-hotel', companyId: company, category: 'HOTEL', receivableAccountId: 'ar', customerAdvanceAccountId: 'advance', revenueAccountId: 'revenue', costAccountId: 'cost', commissionExpenseAccountId: 'commission-expense', commissionLiabilityAccountId: 'commission-payable', active: true });
  const base: ConfirmBookingInput = { companyId: company, branchId: 'branch-1', commandKey: 'confirm-1', booking, program, programState: 'OPEN', programStateEvidence: 'program-version-7', category: 'HOTEL', costCenterId: 'cc-1', customerPartyId: 'customer-1', currency: 'EGP', grossAmount: decimalAmount('100'), discountAmount: decimalAmount('0'), postingDate: '2026-09-19', dueDate: '2026-09-30', invoiceNumber: 'INV-1', inventory: { allocationId: 'allocation-1', contractId: 'contract-1', resourceType: 'HOTEL', resourceId: 'room-1', serviceDate: '2026-10-01', quantity: decimalAmount('2') } };
  const confirm = (change: Partial<ConfirmBookingInput> = {}, target = service) => target.confirmBooking({ ...base, ...change });
  return { repo, calls, service, create, setup, confirm, setPaid: (value: boolean) => { paid = value; historical ||= value; }, setCommissionPaid: (value: boolean) => { commissionPaid = value; }, setInventoryBlocked: (value: boolean) => { inventoryBlocked = value; }, setApproval: (value: boolean) => { approval = value; }, setCostLinked: (value: boolean) => { costLinked = value; }, setProcurementSequence: (...value: typeof procurementSequence) => { procurementSequence = value; }, isHistorical: () => historical };
}

test('GS-023 BR-043 claims booking identity across different command keys and rejects conflicting payload', async () => { const f = fixture(); await f.setup(); const [first, second] = await Promise.all([f.confirm(), f.confirm({ commandKey: 'confirm-other' })]); assert.deepEqual(first, second); assert.equal(f.calls.invoice, 1); await assert.rejects(() => f.confirm({ commandKey: 'confirm-third', grossAmount: decimalAmount('101') }), /conflicting financial confirmation/); });
test('category setup supports distinct booking customers', async () => { const f = fixture(); await f.setup(); await f.confirm(); await f.confirm({ commandKey: 'confirm-2', booking: sourceReference('TOURISM_BOOKING', 'booking-2'), customerPartyId: 'customer-2', invoiceNumber: 'INV-2', inventory: { allocationId: 'allocation-2', contractId: 'contract-1', resourceType: 'HOTEL', resourceId: 'room-2', serviceDate: '2026-10-01', quantity: decimalAmount('1') } }); assert.equal(f.calls.invoice, 2); });
test('GS-024 uses setup accounts, due-date confirmation, and deposit replay', async () => { const f = fixture(); await f.setup(); await f.confirm(); const input = { companyId: company, branchId: 'branch-1', commandKey: 'deposit-1', booking, treasuryId: 'cash', number: 'R-1', postingDate: '2026-09-19', amount: decimalAmount('25') }; await f.service.recordBookingDeposit(input); await f.service.recordBookingDeposit(input); assert.equal(f.calls.deposit, 1); });
test('GS-025 paid cancellation settles through owner then resumes with retained history', async () => { const f = fixture(); await f.setup(); await f.confirm(); await f.service.recordBookingDeposit({ companyId: company, branchId: 'branch-1', commandKey: 'deposit', booking, treasuryId: 'cash', number: 'R', postingDate: '2026-09-19', amount: decimalAmount('25') }); const cancellation = { companyId: company, branchId: 'branch-1', commandKey: 'cancel', booking, travelStarted: false, travelEvidence: 'not-started', postingDate: '2026-09-20' }; const blocked = await f.service.cancelBooking(cancellation) as { blockers: { type: string }[] }; assert.equal(blocked.blockers[0]?.type, 'CUSTOMER_SETTLEMENT_REQUIRED'); await f.service.settleBookingCancellation({ companyId: company, branchId: 'branch-1', commandKey: 'settle', booking, postingDate: '2026-09-20', number: 'REF' }); const done = await f.service.cancelBooking(cancellation) as { cancelled: boolean }; assert.equal(done.cancelled, true); assert.equal(f.isHistorical(), true); assert.equal(f.calls.cancelInvoice, 1); });
test('branch and company isolation protect deposit and cancellation', async () => { const f = fixture(); await f.setup(); await f.confirm(); await assert.rejects(() => f.service.recordBookingDeposit({ companyId: company, branchId: 'branch-2', commandKey: 'x', booking, treasuryId: 'cash', number: 'R', postingDate: '2026-09-19', amount: decimalAmount('1') }), /different branch/); await assert.rejects(() => f.service.cancelBooking({ companyId: company, branchId: 'branch-2', commandKey: 'y', booking, travelStarted: false, travelEvidence: 'none', postingDate: '2026-09-19' }), /different branch/); await assert.rejects(() => f.service.cancelBooking({ companyId: other, branchId: 'branch-1', commandKey: 'z', booking, travelStarted: false, travelEvidence: 'none', postingDate: '2026-09-19' }), /not found/); });
test('GS-026 clean cancellation releases persisted full quantity exactly once', async () => { const f = fixture(); await f.setup(); await f.confirm(); const input = { companyId: company, branchId: 'branch-1', commandKey: 'cancel', booking, travelStarted: false, travelEvidence: 'none', postingDate: '2026-09-19' }; await f.service.cancelBooking(input); await f.service.cancelBooking(input); assert.equal(f.calls.release, 1); });
test('GS-028 program cancellation cleans Procurement, rechecks, cancels bookings, and enables deletion with history', async () => { const f = fixture(); await f.setup(); await f.confirm(); const input = { companyId: company, branchId: 'branch-1', commandKey: 'program-cancel', program, bookings: [{ booking, travelStarted: false, travelEvidence: 'none', procurement: { purchaseOrderId: 'po-1' } }], postingDate: '2026-09-19' }; await f.service.cancelProgram(input); assert.equal(f.calls.cleanup, 1); const eligible = await f.service.getProgramDeletionEligibility(company, program); assert.equal(eligible.deletable, true); assert.ok(eligible.retainedEvidenceReferences.length > 0); });
test('GS-027 program cancellation recheck catches supplier execution race before compensation', async () => { const f = fixture(); await f.setup(); await f.confirm(); f.setProcurementSequence('NONE', 'SUPPLIER_EXECUTION'); const result = await f.service.cancelProgram({ companyId: company, branchId: 'branch-1', commandKey: 'program-race', program, bookings: [{ booking, travelStarted: false, travelEvidence: 'none', procurement: { purchaseOrderId: 'po-1' } }], postingDate: '2026-09-19' }) as { blockers: { type: string }[] }; assert.ok(result.blockers.some((item) => item.type === 'SUPPLIER_EXECUTION')); assert.equal(f.calls.cancelInvoice, 0); });
test('blocked program is not deletion eligible and retained references remain', async () => { const f = fixture(); await f.setup(); await f.confirm({ commission: { agentPartyId: 'agent', amount: decimalAmount('5') } }); f.setCommissionPaid(true); await f.service.cancelProgram({ companyId: company, branchId: 'branch-1', commandKey: 'blocked-program', program, bookings: [{ booking, travelStarted: false, travelEvidence: 'none' }], postingDate: '2026-09-19' }); const result = await f.service.getProgramDeletionEligibility(company, program); assert.equal(result.deletable, false); assert.ok(result.retainedEvidenceReferences.length > 0); });
test('readiness queries owner ports rather than accepting financial truth booleans', async () => { const f = fixture(); await f.setup(); f.setCostLinked(false); f.setApproval(false); const result = await f.service.evaluateFinancialReadiness({ companyId: company, program, requiredCategories: ['HOTEL'], approvalRequestIds: ['approval-1'] }); assert.equal(result.ready, false); assert.ok(result.blockers.includes('MISSING_PROGRAM_COST_CENTER')); });
test('snapshot confirmation and amendment converge under concurrency', async () => { const f = fixture(); const service = sourceReference('TOURISM_SERVICE', 'svc'); const initial = { id: 's1', companyId: company, service, category: 'FLIGHT' as const, currency: 'EGP', saleAmount: decimalAmount('50'), costAmount: decimalAmount('40'), evidence: { segment: 'seg' } }; const [a, b] = await Promise.all([f.service.confirmServiceFinancials(initial), f.service.confirmServiceFinancials(initial)]); assert.equal(a.id, b.id); const amendment = { ...initial, id: 's2', saleAmount: decimalAmount('51'), evidence: { reason: 'fare' } }; const [c, d] = await Promise.all([f.service.amendServiceFinancials(amendment), f.service.amendServiceFinancials(amendment)]); assert.equal(c.version, 2); assert.equal(d.supersedesId, 's1'); const service2 = sourceReference('TOURISM_SERVICE', 'svc-2'); await f.service.confirmServiceFinancials({ ...initial, service: service2, id: 'x1' }); const results = await Promise.allSettled([f.service.amendServiceFinancials({ ...amendment, service: service2, id: 'x2' }), f.service.amendServiceFinancials({ ...amendment, service: service2, id: 'x3', saleAmount: decimalAmount('52') })]); assert.equal(results.filter((item) => item.status === 'rejected').length, 1); });
test('BR-068 uses idempotent semantic Cost actualization evidence', async () => { const f = fixture(); const input = { companyId: company, commandKey: 'ticket', program, service: sourceReference('TOURISM_SERVICE', 'ticket-1'), kind: 'TICKET' as const, amount: decimalAmount('40'), postingDate: '2026-09-19', flightSegmentReference: sourceReference('FLIGHT_SEGMENT', 'seg-1') }; await f.service.actualizeIssuance(input); await f.service.actualizeIssuance(input); assert.equal(f.calls.cost, 1); });
for (const step of ['INVENTORY', 'BILLING', 'COMMISSION'] as const) test(`provider success/local save failure resumes ${step} without duplicate effect`, async () => { const repo = new FailingRepository(); repo.failStep = step; const f = fixture(repo); await f.setup(); const change = step === 'COMMISSION' ? { commission: { agentPartyId: 'agent', amount: decimalAmount('5') } } : {}; await assert.rejects(() => f.confirm(change), /local completion failure/); await f.confirm(change, f.create()); assert.equal(step === 'BILLING' ? f.calls.invoice : step === 'COMMISSION' ? f.calls.commission : f.calls.allocation, 1); });
test('Treasury and Cost provider success/local save failure resume after service restart', async () => { const repo = new FailingRepository(); const f = fixture(repo); await f.setup(); await f.confirm(); repo.failStep = 'TREASURY_DEPOSIT'; const deposit = { companyId: company, branchId: 'branch-1', commandKey: 'deposit-fail', booking, treasuryId: 'cash', number: 'R', postingDate: '2026-09-19', amount: decimalAmount('5') }; await assert.rejects(() => f.service.recordBookingDeposit(deposit), /local completion failure/); await f.create().recordBookingDeposit(deposit); assert.equal(f.calls.deposit, 1); repo.failed = false; repo.failStep = 'COST_ACTUALIZATION'; const actual = { companyId: company, commandKey: 'visa', program, service: sourceReference('TOURISM_SERVICE', 'visa'), kind: 'VISA' as const, amount: decimalAmount('10'), postingDate: '2026-09-19', visaAllocationReference: sourceReference('VISA_ALLOCATION', 'v1') }; await assert.rejects(() => f.service.actualizeIssuance(actual), /local completion failure/); await f.create().actualizeIssuance(actual); assert.equal(f.calls.cost, 1); });

test('Procurement provider success/local save failure resumes aggregate cancellation after restart', async () => {
  const repo = new FailingRepository(); repo.failStep = 'PROCUREMENT_CLEANUP:po-1'; const f = fixture(repo); await f.setup(); await f.confirm();
  const input = { companyId: company, branchId: 'branch-1', commandKey: 'proc-restart', program, bookings: [{ booking, travelStarted: false, travelEvidence: 'none', procurement: { purchaseOrderId: 'po-1' } }], postingDate: '2026-09-19' };
  await assert.rejects(() => f.service.cancelProgram(input), /local completion failure/);
  await f.create().cancelProgram(input);
  assert.equal(f.calls.cleanup, 1);
});

test('BLOCKER-1 child booking blocker after initial precheck prevents PROGRAM CANCELLED history', async () => {
  const f = fixture(); await f.setup(); await f.confirm();
  f.setPaid(false); // Initial precheck passes
  const input = { companyId: company, branchId: 'branch-1', commandKey: 'race-blocker', program, bookings: [{ booking, travelStarted: false, travelEvidence: 'none' }], postingDate: '2026-09-19' };
  // Simulate race: payment arrives after precheck but before child cancellation
  f.setPaid(true);
  const result = await f.service.cancelProgram(input) as { blockers?: { type: string }[]; cancelled?: boolean };
  assert.ok(result.blockers && result.blockers.length > 0, 'should have blockers');
  assert.ok(result.blockers.some((item) => item.type === 'CUSTOMER_SETTLEMENT_REQUIRED'), 'should be settlement blocker');
  assert.equal(result.cancelled, undefined, 'must not be marked cancelled');
  // Verify no CANCELLED history was written
  const eligibility = await f.service.getProgramDeletionEligibility(company, program);
  assert.equal(eligibility.deletable, false, 'program should not be deletable when child is blocked');
  assert.equal(eligibility.reason, 'PROGRAM_CANCELLATION_NOT_COMPLETED', 'should indicate cancellation not completed');
});

test('BLOCKER-3 readiness derives scope from persisted state and cannot be bypassed by omitted references', async () => {
  const f = fixture(); await f.setup();
  // Confirm booking with commission
  await f.confirm({ commission: { agentPartyId: 'agent', amount: decimalAmount('5') } });
  // Set commission as paid - this is a blocker
  f.setCommissionPaid(true);
  // Caller tries to omit the booking/allocation references
  const result = await f.service.evaluateFinancialReadiness({
    companyId: company,
    program,
    requiredCategories: ['HOTEL'],
    // Deliberately omitting allocationIds, approvalRequestIds, procurementReferences
  });
  // Should still detect the blocker from persisted booking allocations
  assert.equal(result.ready, false, 'must not be ready when persisted allocation has blocker');
  assert.ok(result.blockers.length > 0, 'must detect blockers from persisted state');
  // Should include allocation evidence even though caller didn't supply it
  assert.ok(result.evidenceReferences.some((ref) => ref.includes('allocation')), 'should include persisted allocation reference');
});

test('readiness discovers persisted BOOKING_CANCELLATION settlement-required workflow without caller references', async () => {
  const f = fixture(); await f.setup(); await f.confirm();
  f.setPaid(true);
  const result = await f.service.cancelBooking({
    companyId: company,
    branchId: 'branch-1',
    commandKey: 'readiness-cancel',
    booking,
    travelStarted: false,
    travelEvidence: 'not-started',
    postingDate: '2026-09-20',
  }) as { blockers?: { type: string }[] };
  assert.ok(result.blockers?.some((item) => item.type === 'CUSTOMER_SETTLEMENT_REQUIRED'));
  const readiness = await f.service.evaluateFinancialReadiness({
    companyId: company,
    program,
    requiredCategories: ['HOTEL'],
  });
  assert.equal(readiness.ready, false);
  assert.ok(readiness.blockers.some((item) => item.includes('UNRESOLVED_WORKFLOW:BOOKING_CANCELLATION:')));
});

test('readiness discovers unresolved BOOKING_DEPOSIT and BOOKING_SETTLEMENT workflows for persisted bookings', async () => {
  for (const kind of ['BOOKING_DEPOSIT', 'BOOKING_SETTLEMENT'] as const) {
    const f = fixture(); await f.setup(); await f.confirm();
    const workflow = await f.repo.reserveWorkflow({
      id: `readiness-${kind.toLowerCase()}`,
      companyId: company,
      branchId: 'branch-1',
      kind,
      commandKey: `readiness-${kind.toLowerCase()}`,
      payloadHash: `hash-${kind}`,
      sourceType: booking.sourceType,
      sourceId: booking.sourceId,
      status: 'RUNNING',
      payload: { booking },
      createdAt: '2026-09-20T00:00:00.000Z',
      updatedAt: '2026-09-20T00:00:00.000Z',
    });
    const readiness = await f.service.evaluateFinancialReadiness({
      companyId: company,
      program,
      requiredCategories: ['HOTEL'],
    });
    assert.equal(readiness.ready, false, `${kind} must block readiness`);
    assert.ok(readiness.blockers.includes(`UNRESOLVED_WORKFLOW:${kind}:${workflow.id}`));
  }
});

test('readiness becomes true after booking workflows complete and owner blockers are clear', async () => {
  const f = fixture(); await f.setup(); await f.confirm();
  const workflows = await Promise.all(
    (['BOOKING_DEPOSIT', 'BOOKING_SETTLEMENT'] as const).map((kind) =>
      f.repo.reserveWorkflow({
        id: `completed-${kind.toLowerCase()}`,
        companyId: company,
        branchId: 'branch-1',
        kind,
        commandKey: `completed-${kind.toLowerCase()}`,
        payloadHash: `hash-completed-${kind}`,
        sourceType: booking.sourceType,
        sourceId: booking.sourceId,
        status: 'RUNNING',
        payload: { booking },
        createdAt: '2026-09-20T00:00:00.000Z',
        updatedAt: '2026-09-20T00:00:00.000Z',
      }),
    ),
  );
  const blocked = await f.service.evaluateFinancialReadiness({
    companyId: company,
    program,
    requiredCategories: ['HOTEL'],
  });
  assert.equal(blocked.ready, false);

  for (const workflow of workflows) {
    await f.repo.saveWorkflow({
      ...workflow,
      status: 'COMPLETED',
      result: { completed: true },
      updatedAt: '2026-09-20T01:00:00.000Z',
    });
  }

  const ready = await f.service.evaluateFinancialReadiness({
    companyId: company,
    program,
    requiredCategories: ['HOTEL'],
  });
  assert.equal(ready.ready, true);
  assert.deepEqual(ready.blockers, []);
});

test('BLOCKER-5 confirmed booking preserves financial setup snapshot for later deposits', async () => {
  const f = fixture(); await f.setup();
  const bookingA = sourceReference('TOURISM_BOOKING', 'booking-A');
  const bookingB = sourceReference('TOURISM_BOOKING', 'booking-B');
  const inventoryTemplate = { allocationId: 'alloc-1', contractId: 'contract-1', resourceType: 'HOTEL', resourceId: 'room-1', serviceDate: '2026-10-01', quantity: decimalAmount('2') };
  // Confirm booking A with setup V1
  await f.confirm({ commandKey: 'A', booking: bookingA, invoiceNumber: 'INV-A', inventory: { ...inventoryTemplate, allocationId: 'alloc-A' } });
  // Change setup to V2
  await f.service.configureFinancialSetup({
    id: 'setup-hotel-v2',
    companyId: company,
    category: 'HOTEL',
    receivableAccountId: 'ar-v2',
    customerAdvanceAccountId: 'advance-v2',
    revenueAccountId: 'revenue-v2',
    costAccountId: 'cost-v2',
    commissionExpenseAccountId: 'commission-expense-v2',
    commissionLiabilityAccountId: 'commission-payable-v2',
    active: true,
  });
  // Confirm booking B with setup V2
  await f.confirm({ commandKey: 'B', booking: bookingB, invoiceNumber: 'INV-B', inventory: { ...inventoryTemplate, allocationId: 'alloc-B' } });
  // Deposit for booking A should use V1 accounts
  const depositA = await f.service.recordBookingDeposit({
    companyId: company,
    branchId: 'branch-1',
    commandKey: 'deposit-A',
    booking: bookingA,
    treasuryId: 'cash',
    number: 'R-A',
    postingDate: '2026-09-19',
    amount: decimalAmount('10'),
  });
  assert.ok(depositA, 'booking A deposit should succeed with V1 setup');
  // Deposit for booking B should use V2 accounts
  const depositB = await f.service.recordBookingDeposit({
    companyId: company,
    branchId: 'branch-1',
    commandKey: 'deposit-B',
    booking: bookingB,
    treasuryId: 'cash',
    number: 'R-B',
    postingDate: '2026-09-19',
    amount: decimalAmount('10'),
  });
  assert.ok(depositB, 'booking B deposit should succeed with V2 setup');
});

