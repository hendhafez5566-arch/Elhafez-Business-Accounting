import { createHash } from 'node:crypto';
import { ContractValidationError, decimalAmount, type CompanyId, type DecimalAmount, type SourceReference } from '@elhafez/contracts';
import type { TourismFinanceRepository } from './orchestration.repository.js';
import type { BillingPort, CommissionPort, ControlsPort, CostPort, InventoryPort, ProcurementPort, TreasuryPort } from './ports.js';
import type { BookingReference, CancellationBlocker, FinancialSetup, ServiceCategory, ServiceFinancialSnapshot, Workflow, WorkflowKind } from '../domain/orchestration.js';

function stable(value: unknown): string { if (value === null || typeof value !== 'object') return JSON.stringify(value); if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`; return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`; }
function hash(value: unknown) { return createHash('sha256').update(stable(value)).digest('hex'); }
function refKey(value: SourceReference) { return `${value.sourceType}:${value.sourceId}`; }
function required(value: string, field: string) { if (!value?.trim()) throw new ContractValidationError(field, 'is required'); }
function nonNegative(value: DecimalAmount, field: string) { const result = decimalAmount(value); if (result.startsWith('-')) throw new ContractValidationError(field, 'must not be negative'); return result; }
function units(value: DecimalAmount) { const [whole, fraction = ''] = value.split('.'); return BigInt(whole! + fraction.padEnd(18, '0')); }
function fromUnits(value: bigint) { const negative = value < 0n; const absolute = negative ? -value : value; const whole = absolute / 10n ** 18n; const fraction = absolute % 10n ** 18n; return decimalAmount(`${negative ? '-' : ''}${whole}${fraction ? `.${fraction.toString().padStart(18, '0').replace(/0+$/, '')}` : ''}`); }

export interface ConfirmBookingInput { companyId: CompanyId; branchId?: string; commandKey: string; booking: SourceReference; program: SourceReference; programState: 'OPEN' | 'CLOSED' | 'CANCELLED'; programStateEvidence: string; category: ServiceCategory; costCenterId: string; customerPartyId: string; currency: string; grossAmount: DecimalAmount; discountAmount: DecimalAmount; approvalRequestId?: string; postingDate: string; dueDate: string; invoiceNumber: string; inventory: { allocationId: string; contractId: string; resourceType: string; resourceId: string; serviceDate: string; quantity: DecimalAmount; flightSegmentReference?: SourceReference; visaBatchReference?: SourceReference }; commission?: { agentPartyId: string; amount: DecimalAmount }; }
export interface CancelBookingInput { companyId: CompanyId; branchId?: string; commandKey: string; booking: SourceReference; travelStarted: boolean; travelEvidence: string; postingDate: string; }
export interface ProcurementReference { purchaseOrderId?: string; commitmentId?: string; }

export class TourismFinanceOrchestrationApplicationService {
  constructor(private readonly repo: TourismFinanceRepository, private readonly billing: BillingPort, private readonly treasury: TreasuryPort, private readonly commission: CommissionPort, private readonly cost: CostPort, private readonly inventory: InventoryPort, private readonly procurement: ProcurementPort, private readonly controls: ControlsPort) {}

  async configureFinancialSetup(input: FinancialSetup) { required(input.id, 'id'); const value = { ...input, active: true }; await this.repo.saveSetup(value); return value; }
  private async workflow(kind: WorkflowKind, input: { companyId: CompanyId; branchId?: string; commandKey: string }, source: SourceReference, payload: unknown) { required(input.commandKey, 'commandKey'); const payloadHash = hash(payload); const old = await this.repo.workflow(input.companyId, input.commandKey); if (old) { if (old.payloadHash !== payloadHash || old.kind !== kind) throw new ContractValidationError('commandKey', 'conflicting replay'); return old; } const now = new Date().toISOString(); const value: Workflow = { id: hash([input.companyId, input.commandKey]).slice(0, 32), companyId: input.companyId, ...(input.branchId ? { branchId: input.branchId } : {}), kind, commandKey: input.commandKey, payloadHash, sourceType: source.sourceType, sourceId: source.sourceId, status: 'RUNNING', payload, createdAt: now, updatedAt: now }; const reserved = await this.repo.reserveWorkflow(value); if (reserved.payloadHash !== payloadHash) throw new ContractValidationError('commandKey', 'conflicting replay'); return reserved; }
  private async effect<T>(workflow: Workflow, name: string, call: (key: string) => Promise<T>, reference: (result: T) => string | undefined): Promise<T> { const prior = await this.repo.step(workflow.companyId, workflow.id, name); if (prior?.status === 'COMPLETED') return prior.result as T; const step = prior ?? await this.repo.reserveStep({ id: hash([workflow.id, name]).slice(0, 32), companyId: workflow.companyId, workflowId: workflow.id, name, effectKey: `TFO:${workflow.id}:${name}`, status: 'PENDING', createdAt: new Date().toISOString() }); const result = await call(step.effectKey); await this.repo.completeStep(workflow.companyId, step.id, reference(result), result); return result; }
  private async complete(workflow: Workflow, result: unknown, status: Workflow['status'] = 'COMPLETED') { const value = { ...workflow, status, result, updatedAt: new Date().toISOString() }; await this.repo.saveWorkflow(value); return value; }
  private assertBranch(booking: BookingReference, branchId?: string) { if (booking.branchId !== branchId) throw new ContractValidationError('branchId', 'booking belongs to a different branch'); }

  async confirmBooking(input: ConfirmBookingInput) {
    required(input.booking.sourceId, 'booking.sourceId'); required(input.program.sourceId, 'program.sourceId'); required(input.customerPartyId, 'customerPartyId'); required(input.programStateEvidence, 'programStateEvidence'); required(input.dueDate, 'dueDate');
    if (input.programState !== 'OPEN') throw new ContractValidationError('programState', 'selling requires OPEN program');
    const gross = nonNegative(input.grossAmount, 'grossAmount'); const discount = nonNegative(input.discountAmount, 'discountAmount'); if (units(discount) > units(gross)) throw new ContractValidationError('discountAmount', 'cannot exceed gross'); const net = fromUnits(units(gross) - units(discount));
    const financialPayload = { branchId: input.branchId ?? null, booking: input.booking, program: input.program, programState: input.programState, programStateEvidence: input.programStateEvidence, category: input.category, costCenterId: input.costCenterId, customerPartyId: input.customerPartyId, currency: input.currency, grossAmount: gross, discountAmount: discount, approvalRequestId: input.approvalRequestId ?? null, postingDate: input.postingDate, dueDate: input.dueDate, invoiceNumber: input.invoiceNumber, inventory: input.inventory, commission: input.commission ?? null };
    const confirmationPayloadHash = hash(financialPayload); let workflow = await this.workflow('BOOKING_CONFIRMATION', input, input.booking, financialPayload);
    const existing = await this.repo.booking(input.companyId, input.booking);
    const setup = existing ? undefined : await this.repo.setup(input.companyId, input.category);
    if (!existing && !setup?.active) throw new ContractValidationError('financialSetup', `missing ${input.category} setup`);
    const financialSetup = existing?.financialSetup ?? { receivableAccountId: setup!.receivableAccountId, customerAdvanceAccountId: setup!.customerAdvanceAccountId, revenueAccountId: setup!.revenueAccountId, ...(setup!.commissionExpenseAccountId ? { commissionExpenseAccountId: setup!.commissionExpenseAccountId } : {}), ...(setup!.commissionLiabilityAccountId ? { commissionLiabilityAccountId: setup!.commissionLiabilityAccountId } : {}) };
    const reservation: BookingReference = { id: hash([input.companyId, refKey(input.booking)]).slice(0, 32), companyId: input.companyId, ...(input.branchId ? { branchId: input.branchId } : {}), booking: input.booking, program: input.program, customerPartyId: input.customerPartyId, confirmationPayloadHash, status: 'CONFIRMING', allocations: [], ...(input.approvalRequestId ? { approvalRequestId: input.approvalRequestId } : {}), depositVoucherIds: [], workflowId: workflow.id, financialSetup };
    const claimed = await this.repo.reserveBooking(reservation);
    if (claimed.confirmationPayloadHash !== confirmationPayloadHash) throw new ContractValidationError('booking', 'conflicting financial confirmation replay');
    if (claimed.workflowId !== workflow.id) { const canonical = await this.repo.workflowById(input.companyId, claimed.workflowId); if (!canonical) throw new ContractValidationError('booking', 'canonical confirmation workflow is missing'); workflow = canonical; }
    if (workflow.status === 'COMPLETED') return workflow.result;
    const claimedSetup = claimed.financialSetup;
    if (discount !== '0') await this.controls.authorizeDiscount({ companyId: input.companyId, ...(input.branchId ? { branchId: input.branchId } : {}), booking: input.booking, amount: discount, ...(input.approvalRequestId ? { approvalRequestId: input.approvalRequestId } : {}) });
    await this.effect(workflow, 'COST_CENTER', () => this.cost.ensureProgram(input.companyId, input.program, input.costCenterId), (value) => value.costCenterId);
    const allocation = await this.effect(workflow, 'INVENTORY', (key) => this.inventory.allocate({ companyId: input.companyId, ...input.inventory, program: input.program }, key), (value) => value.allocationId ?? value.procurementReference);
    const invoice = await this.effect(workflow, 'BILLING', () => this.billing.createBookingInvoice({ id: `tfo-invoice:${workflow.id}`, companyId: input.companyId, ...(input.branchId ? { branchId: input.branchId } : {}), partyId: input.customerPartyId, number: input.invoiceNumber, postingDate: input.postingDate, dueDate: input.dueDate, currency: input.currency, sourceId: workflow.id, receivableAccountId: claimedSetup.receivableAccountId, revenueAccountId: claimedSetup.revenueAccountId, amount: net }), (value) => value.id);
    let commissionClaimId = claimed.commissionClaimId; if (input.commission) { const expenseAccountId = claimedSetup.commissionExpenseAccountId; const liabilityAccountId = claimedSetup.commissionLiabilityAccountId; if (!expenseAccountId || !liabilityAccountId) throw new ContractValidationError('financialSetup', 'commission accounts required'); const claim = await this.effect(workflow, 'COMMISSION', () => this.commission.create({ id: `tfo-commission:${workflow.id}`, companyId: input.companyId, ...(input.branchId ? { branchId: input.branchId } : {}), agentPartyId: input.commission!.agentPartyId, sourceId: workflow.id, currency: input.currency, amount: input.commission!.amount, expenseAccountId, liabilityAccountId }), (value) => value.id); commissionClaimId = claim.id; }
    const finalBooking: BookingReference = { ...claimed, status: 'ACTIVE', invoiceId: invoice.id, allocations: allocation.allocationId ? [{ id: allocation.allocationId, quantity: input.inventory.quantity }] : [], ...(allocation.procurementReference ? { procurementReference: { purchaseOrderId: allocation.procurementReference } } : {}), ...(commissionClaimId ? { commissionClaimId } : {}) }; await this.repo.saveBooking(finalBooking); return (await this.complete(workflow, finalBooking)).result;
  }

  async recordBookingDeposit(input: { companyId: CompanyId; branchId?: string; commandKey: string; booking: SourceReference; treasuryId: string; number: string; postingDate: string; amount: DecimalAmount }) { const booking = await this.repo.booking(input.companyId, input.booking); if (!booking?.invoiceId) throw new ContractValidationError('booking', 'confirmed financial reference not found'); this.assertBranch(booking, input.branchId); const amount = nonNegative(input.amount, 'amount'); if (amount === '0') throw new ContractValidationError('amount', 'must be positive'); const setup = await this.requiredSetupForBooking(booking); const workflow = await this.workflow('BOOKING_DEPOSIT', input, input.booking, { ...input, amount }); if (workflow.status === 'COMPLETED') return workflow.result; const voucher = await this.effect(workflow, 'TREASURY_DEPOSIT', () => this.treasury.postDeposit({ id: `tfo-deposit:${workflow.id}`, companyId: input.companyId, ...(input.branchId ? { branchId: input.branchId } : {}), treasuryId: input.treasuryId, partyId: booking.customerPartyId, invoiceId: booking.invoiceId!, number: input.number, postingDate: input.postingDate, amount, controlAccountId: setup.receivableAccountId, advanceAccountId: setup.customerAdvanceAccountId }), (value) => value.id); if (!booking.depositVoucherIds.includes(voucher.id)) await this.repo.saveBooking({ ...booking, depositVoucherIds: [...booking.depositVoucherIds, voucher.id] }); return (await this.complete(workflow, { workflowId: workflow.id, voucherId: voucher.id, invoiceId: booking.invoiceId })).result; }
  private async requiredSetupForBooking(booking: BookingReference) {
    // BLOCKER-5: Use snapshotted financial setup from booking confirmation
    return {
        receivableAccountId: booking.financialSetup.receivableAccountId,
        customerAdvanceAccountId: booking.financialSetup.customerAdvanceAccountId,
        revenueAccountId: booking.financialSetup.revenueAccountId,
        costAccountId: '', // Not needed for deposit
        commissionExpenseAccountId: booking.financialSetup.commissionExpenseAccountId,
        commissionLiabilityAccountId: booking.financialSetup.commissionLiabilityAccountId,
      };
  }

  async settleBookingCancellation(input: { companyId: CompanyId; branchId?: string; commandKey: string; booking: SourceReference; postingDate: string; number: string }) { const booking = await this.repo.booking(input.companyId, input.booking); if (!booking) throw new ContractValidationError('booking', 'financial reference not found'); this.assertBranch(booking, input.branchId); const workflow = await this.workflow('BOOKING_SETTLEMENT', input, input.booking, input); if (workflow.status === 'COMPLETED') return workflow.result; for (const voucherId of booking.depositVoucherIds) await this.effect(workflow, `REVERSE_DEPOSIT:${voucherId}`, () => this.treasury.reverseDeposit(input.companyId, voucherId, input.postingDate, `${input.number}-${voucherId}`), (value) => value.id); return (await this.complete(workflow, { workflowId: workflow.id, settled: true, retainedVoucherIds: booking.depositVoucherIds })).result; }
  async getBookingCancellationBlockers(input: { companyId: CompanyId; branchId?: string; booking: SourceReference; travelStarted: boolean; travelEvidence: string; procurement?: ProcurementReference }) { const booking = await this.repo.booking(input.companyId, input.booking); if (!booking?.invoiceId) throw new ContractValidationError('booking', 'confirmed financial reference not found'); this.assertBranch(booking, input.branchId); const blockers: CancellationBlocker[] = []; if (input.travelStarted) blockers.push({ type: 'TRAVEL_STARTED', reference: input.travelEvidence }); const bill = await this.billing.cancellationEvidence(input.companyId, booking.invoiceId); if (bill.settlementRequired) blockers.push({ type: 'CUSTOMER_SETTLEMENT_REQUIRED', reference: booking.invoiceId }); if (booking.commissionClaimId && (await this.commission.evidence(input.companyId, booking.commissionClaimId)).hasPostedPaymentHistory) blockers.push({ type: 'PAID_COMMISSION', reference: booking.commissionClaimId }); for (const allocation of booking.allocations) for (const item of await this.inventory.blockers(input.companyId, allocation.id)) blockers.push({ type: 'INVENTORY', reference: allocation.id, detail: item.type }); if (input.procurement) for (const item of await this.procurement.blockers(input.companyId, input.procurement)) blockers.push({ type: item.type, reference: item.purchaseOrderId, detail: item.lineId }); return { booking, blockers, billingEvidence: bill }; }
  async cancelBooking(input: CancelBookingInput) { const workflow = await this.workflow('BOOKING_CANCELLATION', input, input.booking, input); if (workflow.status === 'COMPLETED') return workflow.result; const evidence = await this.getBookingCancellationBlockers(input); if (evidence.blockers.length) { const settlement = evidence.blockers.some((item) => item.type === 'CUSTOMER_SETTLEMENT_REQUIRED'); return (await this.complete(workflow, { workflowId: workflow.id, blockers: evidence.blockers }, settlement ? 'SETTLEMENT_REQUIRED' : 'BLOCKED')).result; } const booking = evidence.booking; if (booking.commissionClaimId) await this.effect(workflow, 'REVERSE_COMMISSION', () => this.commission.reverse(input.companyId, booking.commissionClaimId!, input.postingDate, `C-${workflow.id}`), (value) => value.id); await this.effect(workflow, 'CANCEL_INVOICE', () => this.billing.cancelInvoice(input.companyId, booking.invoiceId!, input.postingDate, `C-${workflow.id}`), (value) => value.id); for (const allocation of booking.allocations) await this.effect(workflow, `RELEASE:${allocation.id}`, async (key) => { const released = await this.inventory.release(input.companyId, allocation.id, allocation.quantity, key); if (!released.success) throw new ContractValidationError('inventory', 'owner rejected full allocation release'); return released; }, () => allocation.id); await this.repo.saveBooking({ ...booking, status: 'CANCELLED' }); return (await this.complete(workflow, { workflowId: workflow.id, cancelled: true })).result; }
  async cancelProgram(input: { companyId: CompanyId; branchId?: string; commandKey: string; program: SourceReference; bookings: readonly { booking: SourceReference; travelStarted: boolean; travelEvidence: string; procurement?: ProcurementReference }[]; postingDate: string }) {
    const workflow = await this.workflow('PROGRAM_CANCELLATION', input, input.program, input); if (workflow.status === 'COMPLETED') return workflow.result;
    const evaluate = async () => (await Promise.all(input.bookings.map((item) => this.getBookingCancellationBlockers({ companyId: input.companyId, ...(input.branchId ? { branchId: input.branchId } : {}), ...item })))).flatMap((item) => item.blockers);
    let blockers = await evaluate(); if (blockers.length) return (await this.complete(workflow, { workflowId: workflow.id, blockers }, blockers.some((item) => item.type === 'CUSTOMER_SETTLEMENT_REQUIRED') ? 'SETTLEMENT_REQUIRED' : 'BLOCKED')).result;
    blockers = await evaluate(); if (blockers.length) return (await this.complete(workflow, { workflowId: workflow.id, blockers }, 'BLOCKED')).result;
    const procurementReferences = input.bookings.flatMap((item) => item.procurement ? [item.procurement] : []);
    for (const reference of procurementReferences) { const fresh = await this.procurement.blockers(input.companyId, reference); if (fresh.length) return (await this.complete(workflow, { workflowId: workflow.id, blockers: fresh }, 'BLOCKED')).result; try { await this.effect(workflow, `PROCUREMENT_CLEANUP:${reference.purchaseOrderId ?? reference.commitmentId}`, () => this.procurement.cleanupForProgramCancellation(input.companyId, reference), (value) => value.id); } catch (error) { if (error instanceof ContractValidationError) return (await this.complete(workflow, { workflowId: workflow.id, blockers: [{ type: 'PROCUREMENT_CLEANUP_REJECTED', reference: reference.purchaseOrderId ?? reference.commitmentId, detail: error.message }] }, 'BLOCKED')).result; throw error; } }
    const childResults: Array<{ booking: SourceReference; result: unknown; status: 'BLOCKED'|'SETTLEMENT_REQUIRED'|'CANCELLED' }> = [];
    for (const item of input.bookings) {
      const result = await this.cancelBooking({ companyId: input.companyId, ...(input.branchId ? { branchId: input.branchId } : {}), commandKey: `${input.commandKey}:booking:${refKey(item.booking)}`, booking: item.booking, travelStarted: item.travelStarted, travelEvidence: item.travelEvidence, postingDate: input.postingDate }) as { cancelled?: boolean; blockers?: CancellationBlocker[] };
      childResults.push({ booking: item.booking, result, status: result.cancelled ? 'CANCELLED' : result.blockers?.some((blocker) => blocker.type === 'CUSTOMER_SETTLEMENT_REQUIRED') ? 'SETTLEMENT_REQUIRED' : 'BLOCKED' });
    }
    const childBlockers = childResults.filter((item) => item.status === 'BLOCKED' || item.status === 'SETTLEMENT_REQUIRED');
    if (childBlockers.length) { const allBlockers = childBlockers.flatMap((item) => { const result = item.result as { blockers: CancellationBlocker[] }; return result.blockers.map((blocker) => ({ ...blocker, booking: item.booking })); }); const requiresSettlement = allBlockers.some((item) => item.type === 'CUSTOMER_SETTLEMENT_REQUIRED'); return (await this.complete(workflow, { workflowId: workflow.id, blockers: allBlockers, childFailures: childBlockers.map((item) => refKey(item.booking)) }, requiresSettlement ? 'SETTLEMENT_REQUIRED' : 'BLOCKED')).result; }
    await this.repo.saveProgramHistory({ id: hash([workflow.id, 'CANCELLED']).slice(0, 32), companyId: input.companyId, program: input.program, kind: 'CANCELLED', workflowId: workflow.id, evidence: { bookings: input.bookings.map((item) => item.booking) }, createdAt: new Date().toISOString() }); return (await this.complete(workflow, { workflowId: workflow.id, cancelled: true })).result;
  }
  async closeProgram(input: { companyId: CompanyId; branchId?: string; commandKey: string; program: SourceReference; operationalEvidence: string }) { const workflow = await this.workflow('PROGRAM_CLOSE', input, input.program, input); if (workflow.status === 'COMPLETED') return workflow.result; await this.repo.saveProgramHistory({ id: hash([workflow.id, 'CLOSED']).slice(0, 32), companyId: input.companyId, program: input.program, kind: 'CLOSED', workflowId: workflow.id, evidence: { operationalEvidence: input.operationalEvidence }, createdAt: new Date().toISOString() }); return (await this.complete(workflow, { workflowId: workflow.id, closed: true })).result; }
  async getProgramDeletionEligibility(companyId: CompanyId, program: SourceReference) { const history = await this.repo.programHistory(companyId, program); const bookings = await this.repo.bookingsForProgram(companyId, program); const cancelled = history.some((item) => item.kind === 'CANCELLED'); const active = bookings.filter((item) => item.status !== 'CANCELLED'); return { deletable: cancelled && active.length === 0, retainedEvidenceReferences: [...history.map((item) => item.id), ...bookings.flatMap((item) => [item.invoiceId, item.commissionClaimId, ...item.allocations.map((allocation) => allocation.id)].filter((value): value is string => Boolean(value)))], ...(cancelled && active.length === 0 ? {} : { reason: cancelled ? 'ACTIVE_BOOKING_FINANCIAL_STATE' : 'PROGRAM_CANCELLATION_NOT_COMPLETED' }) }; }
  async evaluateFinancialReadiness(input: { companyId: CompanyId; program: SourceReference; requiredCategories: readonly ServiceCategory[]; approvalRequestIds?: readonly string[]; allocationIds?: readonly string[]; procurementReferences?: readonly ProcurementReference[] }) {
    const blockers: string[] = []; const evidenceReferences: string[] = [refKey(input.program)];
    // BR-053: Derive authoritative financial scope from persisted program/booking/workflow state
    const bookings = await this.repo.bookingsForProgram(input.companyId, input.program);
    const programWorkflows = await this.repo.workflowsForProgram(input.companyId, input.program);
    const bookingWorkflows = await Promise.all(bookings.map((booking) => this.repo.workflowById(input.companyId, booking.workflowId)));
    const workflows = [...new Map([...programWorkflows, ...bookingWorkflows.filter((item): item is Workflow => Boolean(item))].map((item) => [item.id, item])).values()];
    
    // 1. Check required category setup (persisted)
    for (const category of input.requiredCategories) {
      const setup = await this.repo.setup(input.companyId, category);
      if (!setup?.active) blockers.push(`MISSING_SETUP:${category}`);
      else evidenceReferences.push(setup.id);
    }
    
    // 2. Check program Cost Center association (from Cost owned data)
    try { const center = await this.cost.resolveProgram(input.companyId, input.program); evidenceReferences.push(center.costCenterId); }
    catch { blockers.push('MISSING_PROGRAM_COST_CENTER'); }
    
    // 3. Check all persisted allocations from bookings
    const allAllocationIds = new Set<string>();
    for (const booking of bookings) {
      for (const allocation of booking.allocations) allAllocationIds.add(allocation.id);
    }
    for (const id of (input.allocationIds ?? [])) allAllocationIds.add(id);
    for (const allocationId of allAllocationIds) {
      const ownerBlockers = await this.inventory.blockers(input.companyId, allocationId);
      blockers.push(...ownerBlockers.map((item) => `INVENTORY:${allocationId}:${item.type}`));
      evidenceReferences.push(allocationId);
    }
    
    // 4. Check persisted commission claim references from bookings
    for (const booking of bookings) {
      if (booking.commissionClaimId) {
        const commEvidence = await this.commission.evidence(input.companyId, booking.commissionClaimId);
        if (commEvidence.hasPostedPaymentHistory) blockers.push(`PAID_COMMISSION:${booking.commissionClaimId}`);
        evidenceReferences.push(booking.commissionClaimId);
      }
    }
    
    // 5. Check persisted procurement references from bookings
    const allProcurementRefs = new Map<string, ProcurementReference>();
    for (const booking of bookings) if (booking.procurementReference) allProcurementRefs.set(booking.procurementReference.purchaseOrderId ?? booking.procurementReference.commitmentId!, booking.procurementReference);
    for (const ref of input.procurementReferences ?? []) {
      const key = ref.purchaseOrderId ?? ref.commitmentId!;
      allProcurementRefs.set(key, ref);
    }
    for (const reference of allProcurementRefs.values()) {
      const ownerBlockers = await this.procurement.blockers(input.companyId, reference);
      blockers.push(...ownerBlockers.map((item) => `PROCUREMENT:${item.type}:${item.purchaseOrderId}`));
      evidenceReferences.push(reference.purchaseOrderId ?? reference.commitmentId!);
    }
    
    // 6. Check unresolved workflows (from AC-12 owned data)
    const unresolvedWorkflows = workflows.filter((w) => w.status === 'RUNNING' || w.status === 'BLOCKED' || w.status === 'SETTLEMENT_REQUIRED');
    for (const workflow of unresolvedWorkflows) {
      blockers.push(`UNRESOLVED_WORKFLOW:${workflow.kind}:${workflow.id}`);
      evidenceReferences.push(workflow.id);
    }
    
    // 7. Check booking financial/cancellation state (from bookings owned state)
    for (const booking of bookings) {
      if (booking.status === 'CANCELLED') {
        const history = await this.repo.programHistory(input.companyId, input.program);
        if (history.some((h) => h.kind === 'CANCELLED')) continue;
        // Booking cancelled but program not yet cancelled - this indicates partial state
        blockers.push(`BOOKING_CANCELLATION_INCOMPLETE:${booking.id}`);
        evidenceReferences.push(booking.id);
      }
    }
    
    // 8. Check approval requestId from booking confirmation evidence (from Controls owned data)
    const approvalRequestIdsFromBookings = new Set<string>();
    for (const booking of bookings) if (booking.approvalRequestId) approvalRequestIdsFromBookings.add(booking.approvalRequestId);
    const allApprovalRequestIds = new Set([...approvalRequestIdsFromBookings, ...(input.approvalRequestIds ?? [])]);
    for (const requestId of allApprovalRequestIds) {
      if (!(await this.controls.approvalResolved(input.companyId, requestId))) blockers.push(`APPROVAL_UNRESOLVED:${requestId}`);
      else evidenceReferences.push(requestId);
    }
    
    return { ready: blockers.length === 0, blockers, warnings: [], evidenceReferences };
  }

  private snapshotCandidate(input: { id: string; companyId: CompanyId; service: SourceReference; category: ServiceCategory; currency: string; saleAmount: DecimalAmount; costAmount: DecimalAmount; evidence: unknown }, version: number, status: ServiceFinancialSnapshot['status'], supersedesId?: string): ServiceFinancialSnapshot { const normalized = { ...input, saleAmount: nonNegative(input.saleAmount, 'saleAmount'), costAmount: nonNegative(input.costAmount, 'costAmount') }; return { ...normalized, version, status, ...(supersedesId ? { supersedesId } : {}), requestHash: hash({ service: input.service, version, category: normalized.category, currency: normalized.currency, saleAmount: normalized.saleAmount, costAmount: normalized.costAmount, evidence: normalized.evidence, supersedesId: supersedesId ?? null }), createdAt: new Date().toISOString() }; }
  async confirmServiceFinancials(input: { id: string; companyId: CompanyId; service: SourceReference; category: ServiceCategory; currency: string; saleAmount: DecimalAmount; costAmount: DecimalAmount; evidence: unknown }) { const candidate = this.snapshotCandidate(input, 1, 'CONFIRMED'); const existing = await this.repo.latestSnapshot(input.companyId, input.service); if (existing) { if (existing.version !== 1 || existing.requestHash !== candidate.requestHash) throw new ContractValidationError('serviceFinancials', 'confirmed fields are immutable; use amendment'); return existing; } const reserved = await this.repo.reserveSnapshot(candidate); if (reserved.requestHash !== candidate.requestHash) throw new ContractValidationError('serviceFinancials', 'conflicting concurrent confirmation'); return reserved; }
  async amendServiceFinancials(input: { id: string; companyId: CompanyId; service: SourceReference; category: ServiceCategory; currency: string; saleAmount: DecimalAmount; costAmount: DecimalAmount; evidence: unknown }) { const old = await this.repo.latestSnapshot(input.companyId, input.service); if (!old) throw new ContractValidationError('service', 'no confirmed financial snapshot'); const candidate = this.snapshotCandidate(input, old.version + 1, 'AMENDED', old.id); const reserved = await this.repo.reserveSnapshot(candidate); if (reserved.requestHash !== candidate.requestHash || reserved.supersedesId !== old.id) throw new ContractValidationError('serviceFinancials', 'conflicting concurrent amendment'); return reserved; }
  async actualizeIssuance(input: { companyId: CompanyId; branchId?: string; commandKey: string; program: SourceReference; service: SourceReference; kind: 'TICKET' | 'VISA'; amount: DecimalAmount; postingDate: string; flightSegmentReference?: SourceReference; visaAllocationReference?: SourceReference }) { const evidence = input.kind === 'TICKET' ? input.flightSegmentReference : input.visaAllocationReference; if (!evidence) throw new ContractValidationError(input.kind === 'TICKET' ? 'flightSegmentReference' : 'visaAllocationReference', `real ${input.kind === 'TICKET' ? 'flight segment' : 'visa allocation'} required`); const amount = nonNegative(input.amount, 'amount'); const workflow = await this.workflow('MILESTONE_ACTUALIZATION', input, input.service, { ...input, amount }); if (workflow.status === 'COMPLETED') return workflow.result; const result = await this.effect(workflow, 'COST_ACTUALIZATION', () => this.cost.actualize({ id: `tfo-cost:${workflow.id}`, companyId: input.companyId, program: input.program, service: input.service, amount, postingDate: input.postingDate, evidence }), (value) => value.id); return (await this.complete(workflow, { workflowId: workflow.id, costEffectId: result.id })).result; }
}
