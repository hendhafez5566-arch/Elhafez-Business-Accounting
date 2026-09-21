import type { BillingSubledgersApplicationService } from '@elhafez/billing-subledgers';
import type { TreasurySettlementApplicationService } from '@elhafez/treasury-settlement';
import type { ExpenseCommissionRecognitionApplicationService } from '@elhafez/expense-commission-recognition';
import type { ProcurementFinanceApplicationService } from '@elhafez/procurement-finance';
import {
  costCenterId,
  type CostBudgetAccountingApplicationService,
} from '@elhafez/cost-budget-accounting';
import type { FinancialControlsApplicationService } from '@elhafez/financial-controls';
import type {
  ContractType,
  TourismContractInventoryApplicationService,
} from '@elhafez/tourism-contract-inventory';
import type {
  BillingPort,
  CommissionPort,
  ControlsPort,
  CostPort,
  InventoryPort,
  ProcurementPort,
  TreasuryPort,
} from '../application/ports.js';

export class BillingAdapter implements BillingPort {
  constructor(private readonly billing: BillingSubledgersApplicationService) {}

  async createBookingInvoice(input: Parameters<BillingPort['createBookingInvoice']>[0]) {
    const draft = await this.billing.createDraft({
      id: input.id,
      companyId: input.companyId,
      ...(input.branchId ? { branchId: input.branchId } : {}),
      type: 'CUSTOMER',
      partyId: input.partyId,
      number: input.number,
      postingDate: input.postingDate,
      dueDate: input.dueDate,
      currency: input.currency,
      sourceType: 'TOURISM_BOOKING',
      sourceId: input.sourceId,
      controlAccountId: input.receivableAccountId,
      lines: [{ id: `${input.id}:1`, accountId: input.revenueAccountId, amount: input.amount }],
    });
    return this.billing.postInvoice(input.companyId, draft.id);
  }

  cancellationEvidence(companyId: Parameters<BillingPort['cancellationEvidence']>[0], id: string) {
    return this.billing.getCancellationEvidence(companyId, id);
  }

  cancelInvoice(companyId: Parameters<BillingPort['cancelInvoice']>[0], id: string, date: string, note: string) {
    return this.billing.cancelInvoice(companyId, id, date, note);
  }
}

export class TreasuryAdapter implements TreasuryPort {
  constructor(private readonly treasury: TreasurySettlementApplicationService) {}

  postDeposit(input: Parameters<TreasuryPort['postDeposit']>[0]) {
    return this.treasury.postVoucher({
      id: input.id,
      companyId: input.companyId,
      ...(input.branchId ? { branchId: input.branchId } : {}),
      treasuryId: input.treasuryId,
      kind: 'RECEIPT',
      partyKind: 'CUSTOMER',
      partyId: input.partyId,
      number: input.number,
      postingDate: input.postingDate,
      amount: input.amount,
      sourceType: 'TOURISM_BOOKING_DEPOSIT',
      sourceId: input.id,
      controlAccountId: input.controlAccountId,
      advanceAccountId: input.advanceAccountId,
      explicitDraftInvoiceId: input.invoiceId,
    });
  }

  reverseDeposit(companyId: Parameters<TreasuryPort['reverseDeposit']>[0], id: string, date: string, note: string) {
    return this.treasury.voidVoucher(companyId, id, date, note);
  }
}

export class CommissionAdapter implements CommissionPort {
  constructor(private readonly expense: ExpenseCommissionRecognitionApplicationService) {}

  create(input: Parameters<CommissionPort['create']>[0]) {
    return this.expense.createCommissionClaim({
      id: input.id,
      companyId: input.companyId,
      ...(input.branchId ? { branchId: input.branchId } : {}),
      agentPartyId: input.agentPartyId,
      sourceType: 'TOURISM_BOOKING',
      sourceId: input.sourceId,
      currency: input.currency,
      amount: input.amount,
      baseCarryingAmount: input.amount,
      expenseAccountId: input.expenseAccountId,
      liabilityAccountId: input.liabilityAccountId,
    });
  }

  evidence(companyId: Parameters<CommissionPort['evidence']>[0], id: string) {
    return this.expense.getCommissionCancellationEvidence(companyId, id);
  }

  reverse(companyId: Parameters<CommissionPort['reverse']>[0], id: string, date: string, note: string) {
    return this.expense.reverseUnpaidCommission(companyId, id, date, note);
  }
}

export class CostAdapter implements CostPort {
  constructor(private readonly cost: CostBudgetAccountingApplicationService) {}

  async ensureProgram(
    companyId: Parameters<CostPort['ensureProgram']>[0],
    program: Parameters<CostPort['ensureProgram']>[1],
    id: string,
  ) {
    const result = await this.cost.ensureProgramCostCenter(companyId, program, costCenterId(id));
    return { costCenterId: result.costCenterId };
  }

  async resolveProgram(
    companyId: Parameters<CostPort['resolveProgram']>[0],
    program: Parameters<CostPort['resolveProgram']>[1],
  ) {
    const result = await this.cost.resolveProgramCostCenter(companyId, program);
    return { costCenterId: result.id };
  }

  async actualize(input: Parameters<CostPort['actualize']>[0]) {
    return this.cost.recordTourismServiceActualization(input);
  }
}

export class InventoryAdapter implements InventoryPort {
  constructor(
    private readonly inventory: Pick<
      TourismContractInventoryApplicationService,
      'allocateCapacity' | 'getReleaseBlockers' | 'releaseAllocation'
    >,
  ) {}

  async allocate(input: Parameters<InventoryPort['allocate']>[0], key: string) {
    const result = await this.inventory.allocateCapacity({
      companyId: input.companyId,
      contractId: input.contractId,
      resourceType: input.resourceType as ContractType,
      resourceId: input.resourceId,
      program: input.program,
      serviceDate: input.serviceDate,
      quantity: input.quantity,
      ...(input.flightSegmentReference ? { flightSegmentReference: input.flightSegmentReference } : {}),
      ...(input.visaBatchReference ? { visaBatchReference: input.visaBatchReference } : {}),
    }, key);
    return {
      allocationId: result.allocation?.id,
      procurementReference: result.procurementRequest?.externalReference,
    };
  }

  async blockers(companyId: Parameters<InventoryPort['blockers']>[0], id: string) {
    return (await this.inventory.getReleaseBlockers(companyId, id)).map((item) => ({
      type: item.code,
      ...(item.evidence ? { evidence: `${item.evidence.sourceType}:${item.evidence.sourceId}` } : {}),
    }));
  }

  async release(
    companyId: Parameters<InventoryPort['release']>[0],
    id: string,
    quantity: Parameters<InventoryPort['release']>[2],
    key: string,
  ) {
    const result = await this.inventory.releaseAllocation(
      { companyId, allocationId: id, quantity },
      key,
    );
    return { success: result.success };
  }
}

export class ProcurementAdapter implements ProcurementPort {
  constructor(private readonly procurement: ProcurementFinanceApplicationService) {}

  blockers(
    companyId: Parameters<ProcurementPort['blockers']>[0],
    query: Parameters<ProcurementPort['blockers']>[1],
  ) {
    return this.procurement.getCancellationBlockers(companyId, query);
  }

  cleanupForProgramCancellation(
    companyId: Parameters<ProcurementPort['cleanupForProgramCancellation']>[0],
    query: Parameters<ProcurementPort['cleanupForProgramCancellation']>[1],
  ) {
    return this.procurement.cleanupForProgramCancellation(companyId, query);
  }
}

export class ControlsAdapter implements ControlsPort {
  constructor(private readonly controls: FinancialControlsApplicationService) {}

  async authorizeDiscount(input: Parameters<ControlsPort['authorizeDiscount']>[0]) {
    const requirement = await this.controls.evaluateApprovalRequirement({
      companyId: input.companyId,
      action: 'BOOKING_DISCOUNT',
      amount: input.amount,
    });
    if (requirement.decision !== 'APPROVAL_REQUIRED' || !input.approvalRequestId) {
      throw new Error('Controls-owned booking discount approval required');
    }
    const request = await this.controls.getApprovalRequest(input.companyId, input.approvalRequestId);
    const decision = await this.controls.getApprovalDecision(input.companyId, input.approvalRequestId);
    if (
      !request ||
      request.action !== 'BOOKING_DISCOUNT' ||
      request.sourceType !== input.booking.sourceType ||
      request.sourceId !== input.booking.sourceId ||
      request.amount !== input.amount ||
      request.branchId !== input.branchId ||
      decision?.outcome !== 'APPROVED'
    ) {
      throw new Error('approval does not authorize exact booking discount');
    }
  }

  async approvalResolved(companyId: string, id: string) {
    return (await this.controls.getApprovalDecision(companyId, id))?.outcome === 'APPROVED';
  }
}
