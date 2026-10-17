import {billingUnits,planInvoiceAdjustment} from '../domain/invoice-adjustment-plan.js';
import {isDeepStrictEqual} from 'node:util';
import { ContractValidationError, type CompanyId, type DecimalAmount } from '@elhafez/contracts';
import type { BillingRepository } from '../application/billing.repository.js';
import type {
  BillingFinancialOperation,ReserveBillingFinancialOperation,CompleteBillingFinancialOperation,
  Advance,
  AdvanceConsumption,
  Adjustment,
  Allocation,
  Invoice,
  PartyKind,
} from '../domain/billing.js';

export class InMemoryBillingRepository implements BillingRepository {
  readonly financialOperations:BillingFinancialOperation[]=[];
  async financialOperation(companyId:CompanyId,id:string){return this.financialOperations.find(x=>x.companyId===companyId&&x.id===id);}
  async reserveFinancialOperation(input:ReserveBillingFinancialOperation){
    const prior=this.financialOperations.find(x=>x.id===input.id||x.companyId===input.companyId&&x.sourceType===input.sourceType&&x.sourceId===input.sourceId);
    if(prior){if(prior.companyId!==input.companyId||prior.id!==input.id||prior.requestHash!==input.requestHash)throw new ContractValidationError('operation','conflicting financial operation identity');return structuredClone(prior);}
    const invoice=this.invoiceValues.find(x=>x.companyId===input.companyId&&x.id===input.invoiceId);
    if(!invoice||invoice.status!=='POSTED'||invoice.recognitionReference||invoice.economicOperationKey)throw new ContractValidationError('invoice','posted invoice without pending operation or recognition required');
    const operation:BillingFinancialOperation={id:input.id,companyId:input.companyId,invoiceId:input.invoiceId,kind:input.kind,sourceType:input.sourceType,sourceId:input.sourceId,requestHash:input.requestHash,snapshot:structuredClone({invoice,adjustments:this.adjustmentValues.filter(x=>x.companyId===input.companyId&&x.invoiceId===input.invoiceId),baseCurrency:input.baseCurrency,basePrecision:input.basePrecision,documentPrecision:input.documentPrecision}),status:'PENDING'};
    if(input.kind==='ADJUSTMENT'){if(!input.adjustmentInput||input.adjustmentInput.companyId!==input.companyId||input.adjustmentInput.invoiceId!==input.invoiceId)throw new ContractValidationError('adjustment','scope mismatch');operation.plan=planInvoiceAdjustment(operation.snapshot,input.adjustmentInput);}
    if(input.kind==='ADJUSTMENT_REVERSAL'){
      const adjustment=this.adjustmentValues.find(x=>x.companyId===input.companyId&&x.id===input.reversalAdjustmentId&&x.invoiceId===invoice.id);if(!adjustment||adjustment.reversedAt)throw new ContractValidationError('adjustment','active adjustment required');
      if(adjustment.kind==='DEBIT_NOTE'&&billingUnits(invoice.outstanding)<billingUnits(adjustment.appliedAmount))throw new ContractValidationError('adjustment','BLOCKED: reversal would make outstanding negative');
      if(this.allocationValues.some(x=>x.companyId===input.companyId&&x.invoiceId===invoice.id&&!x.reversedAt&&x.appliedAmount!=='0'))throw new ContractValidationError('adjustment','BLOCKED: active downstream invoice allocations');
      const currentCenter=invoice.financialDimensions?.currentCostCenterId??invoice.lines[0]?.costCenterId;if((adjustment.costCenterId??undefined)!==(currentCenter??undefined))throw new ContractValidationError('dimension','review a current-center adjustment instead of reversing a transferred revenue allocation');
      const advance=adjustment.advanceId?this.advanceValues.find(x=>x.companyId===input.companyId&&x.id===adjustment.advanceId):undefined;if(advance&&(advance.economicOperationKey||advance.reversedAt||advance.available!==advance.amount))throw new ContractValidationError('adjustment','BLOCKED: generated advance was consumed or reserved');
      operation.snapshot.reversedAdjustment=structuredClone(adjustment);if(advance){operation.snapshot.generatedAdvance=structuredClone(advance);this.replace(this.advanceValues,{...advance,economicOperationKey:operation.id});}
    }
    this.replace(this.financialOperations,operation);this.replace(this.invoiceValues,{...invoice,economicOperationKey:operation.id});return structuredClone(operation);
  }
  async setFinancialOperationPlan(companyId:CompanyId,id:string,requestHash:string,plan:unknown){const operation=this.financialOperations.find(x=>x.companyId===companyId&&x.id===id);if(!operation||operation.requestHash!==requestHash)throw new ContractValidationError('operation','reservation missing');if(operation.plan!==undefined){if(!isDeepStrictEqual(operation.plan,plan))throw new ContractValidationError('operation','plan changed');return structuredClone(operation);}const next={...operation,plan:structuredClone(plan)};this.replace(this.financialOperations,next);return structuredClone(next);}
  async completeFinancialOperation(input:CompleteBillingFinancialOperation){
    const operation=this.financialOperations.find(x=>x.companyId===input.companyId&&x.id===input.id);if(!operation||operation.requestHash!==input.requestHash)throw new ContractValidationError('operation','reservation missing');if(operation.status==='COMPLETED')return structuredClone(operation);
    const current=this.invoiceValues.find(x=>x.companyId===input.companyId&&x.id===operation.invoiceId);
    if(!current||current.economicOperationKey!==operation.id||input.invoice.id!==operation.invoiceId||input.invoice.companyId!==input.companyId||current.outstanding!==operation.snapshot.invoice.outstanding)throw new ContractValidationError('operation','invoice reservation changed');
    const originalAdvance=operation.snapshot.generatedAdvance;if(originalAdvance){const advance=this.advanceValues.find(x=>x.companyId===input.companyId&&x.id===originalAdvance.id);if(!advance||advance.economicOperationKey!==operation.id||advance.available!==originalAdvance.available)throw new ContractValidationError('advance','advance reservation changed');}
    if(input.adjustment&&(input.adjustment.companyId!==input.companyId||input.adjustment.invoiceId!==current.id))throw new ContractValidationError('adjustment','scope mismatch');
    if(input.advance&&(input.advance.companyId!==input.companyId||input.advance.partyId!==current.partyId))throw new ContractValidationError('advance','scope mismatch');
    const {economicOperationKey:pending,...invoice}=input.invoice;void pending;
    this.replace(this.invoiceValues,structuredClone(invoice));if(input.adjustment)this.replace(this.adjustmentValues,structuredClone(input.adjustment));if(input.advance){const {economicOperationKey:advancePending,...advance}=input.advance;void advancePending;this.replace(this.advanceValues,structuredClone(advance));}
    const completed={...operation,status:'COMPLETED' as const,result:structuredClone(input.result)};this.replace(this.financialOperations,completed);return structuredClone(completed);
  }
  readonly invoiceValues: Invoice[] = [];
  readonly allocationValues: Allocation[] = [];
  readonly advanceValues: Advance[] = [];
  readonly adjustmentValues: Adjustment[] = [];
  readonly consumptionValues: AdvanceConsumption[] = [];
  readonly limits = new Map<string, DecimalAmount>();

  private replace<T extends { companyId: CompanyId; id: string }>(values: T[], value: T): void {
    const index = values.findIndex((x) => x.companyId === value.companyId && x.id === value.id);
    if (index < 0) values.push(value);
    else values[index] = value;
  }

  async invoice(companyId: CompanyId, id: string) {
    return this.invoiceValues.find((x) => x.companyId === companyId && x.id === id);
  }

  async invoiceBySource(companyId: CompanyId, sourceType: string, sourceId: string) {
    return this.invoiceValues.find((x) => x.companyId === companyId && x.sourceType === sourceType && x.sourceId === sourceId);
  }

  async supplierExternal(companyId: CompanyId, partyId: string, externalNumber: string) {
    return this.invoiceValues.find(
      (x) =>
        x.companyId === companyId &&
        x.type === 'SUPPLIER' &&
        x.partyId === partyId &&
        x.externalInvoiceNumber === externalNumber,
    );
  }

  async invoices(companyId: CompanyId) {
    return this.invoiceValues.filter((x) => x.companyId === companyId);
  }

  async saveInvoice(value: Invoice) {
    this.replace(this.invoiceValues, value);
  }

  async startRecognition(companyId: CompanyId, id: string, reference: string) {
    const current = this.invoiceValues.find(x=>x.companyId===companyId&&x.id===id);
    if (!current) throw new ContractValidationError('invoice', 'not found');
    if(current.economicOperationKey)throw new ContractValidationError('invoice','resume pending financial operation first');
    if (!current.deferred || current.status !== 'POSTED') throw new ContractValidationError('invoice', 'posted deferred invoice required');
    if (current.recognitionReference) {
      if (current.recognitionReference === reference) return current;
      throw new ContractValidationError('recognitionReference', 'already recorded');
    }
    const next = { ...current, recognitionReference: reference };
    this.replace(this.invoiceValues, next);
    return next;
  }

  async markInvoicePosting(companyId: CompanyId, id: string) {
    const value = this.invoiceValues.find(x=>x.companyId===companyId&&x.id===id);
    if (!value) throw new ContractValidationError('invoice', 'not found');
    if (value.status === 'POSTING') return value;
    if (value.status !== 'DRAFT') throw new ContractValidationError('status', 'invoice cannot enter posting');
    const next = { ...value, status: 'POSTING' as const };
    this.replace(this.invoiceValues, next);
    return next;
  }

  async beginCancellation(companyId: CompanyId, id: string) {
    const value = this.invoiceValues.find(x=>x.companyId===companyId&&x.id===id);
    if (!value) throw new ContractValidationError('invoice', 'not found');
    if(value.economicOperationKey)throw new ContractValidationError('invoice','resume pending financial operation first');
    if (value.status === 'CANCELLING') return value;
    if (value.status !== 'POSTED') throw new ContractValidationError('status', 'only posted invoice may cancel');
    const activeAllocation = this.allocationValues.some(
      (item) => item.companyId === companyId && item.invoiceId === id && !item.reversedAt && item.appliedAmount !== '0',
    );
    const activeAdjustment = this.adjustmentValues.some(
      (item) => item.companyId === companyId && item.invoiceId === id && !item.reversedAt,
    );
    if (activeAllocation || activeAdjustment) {
      throw new ContractValidationError('invoice', 'BLOCKED: active downstream billing effects');
    }
    const next = { ...value, status: 'CANCELLING' as const };
    this.replace(this.invoiceValues, next);
    return next;
  }

  async finalizeInvoicePosting(value: Invoice, allocations: readonly Allocation[], advances: readonly Advance[]) {
    this.replace(this.invoiceValues, value);
    for (const allocation of allocations) this.replace(this.allocationValues, allocation);
    for (const advance of advances) this.replace(this.advanceValues, advance);
  }

  async saveCreditLimit(companyId: CompanyId, partyId: string, amount: DecimalAmount) {
    this.limits.set(`${companyId}:${partyId}`, amount);
  }

  async creditLimit(companyId: CompanyId, partyId: string) {
    return this.limits.get(`${companyId}:${partyId}`);
  }

  async allocationBySource(companyId: CompanyId, sourceType: string, sourceId: string) {
    return this.allocationValues.find(
      (x) => x.companyId === companyId && x.sourceType === sourceType && x.sourceId === sourceId,
    );
  }

  async saveAllocation(value: Allocation) {
    this.replace(this.allocationValues, value);
  }

  async saveAllocationEffect(value: Allocation, invoiceBefore?: Invoice, invoiceAfter?: Invoice, advance?: Advance) {
    if ((invoiceBefore === undefined) !== (invoiceAfter === undefined)) {
      throw new ContractValidationError('invoice', 'allocation effect requires both invoice states');
    }
    if (invoiceBefore && invoiceAfter) {
      const current = this.invoiceValues.find(x=>x.companyId===invoiceBefore.companyId&&x.id===invoiceBefore.id);
      if (!current || current.economicOperationKey || current.outstanding !== invoiceBefore.outstanding || current.status !== invoiceBefore.status) {
        throw new ContractValidationError('concurrency', 'invoice changed; retry allocation');
      }
      this.replace(this.invoiceValues, invoiceAfter);
    }
    this.replace(this.allocationValues, value);
    if (advance) this.replace(this.advanceValues, advance);
  }

  async allocations(companyId: CompanyId, invoiceId?: string) {
    return this.allocationValues.filter(
      (x) => x.companyId === companyId && (!invoiceId || x.invoiceId === invoiceId),
    );
  }

  async advance(companyId: CompanyId, id: string) {
    return this.advanceValues.find((x) => x.companyId === companyId && x.id === id);
  }

  async advances(companyId: CompanyId, partyKind: PartyKind, partyId: string) {
    return this.advanceValues.filter(
      (x) => x.companyId === companyId && x.partyKind === partyKind && x.partyId === partyId,
    );
  }

  async saveAdvance(value: Advance) {
    this.replace(this.advanceValues, value);
  }

  async consumptionBySource(companyId: CompanyId, sourceType: string, sourceId: string) {
    return this.consumptionValues.find(
      (x) => x.companyId === companyId && x.sourceType === sourceType && x.sourceId === sourceId,
    );
  }

  async completeAdvanceConsumption(companyId: CompanyId, sourceType: string, sourceId: string, evidence: NonNullable<AdvanceConsumption['evidence']>) {
    const current = this.consumptionValues.find(x => x.companyId === companyId && x.sourceType === sourceType && x.sourceId === sourceId);
    if (!current || current.reversedAt) throw new ContractValidationError('consumption', 'active refund reservation required');
    if (current.status === 'POSTED') {
      if (!isDeepStrictEqual(current.evidence, evidence)) throw new ContractValidationError('evidence', 'conflicting refund completion replay');
      return current;
    }
    if (current.status !== 'RESERVED') throw new ContractValidationError('consumption', 'refund reservation required');
    const completed = {...current, status: 'POSTED' as const, evidence: {...evidence}};
    this.replace(this.consumptionValues, completed);
    return completed;
  }

  async saveAdvanceConsumptionEffect(
    consumption: AdvanceConsumption,
    advanceBefore: Advance,
    advanceAfter: Advance,
  ) {
    const current = this.advanceValues.find(x=>x.companyId===advanceBefore.companyId&&x.id===advanceBefore.id);
    if(current?.economicOperationKey)throw new ContractValidationError('advance','resume pending financial operation first');
    if (!current || current.available !== advanceBefore.available || current.reversedAt !== advanceBefore.reversedAt) {
      throw new ContractValidationError('concurrency', 'advance changed; retry consumption');
    }
    this.replace(this.advanceValues, advanceAfter);
    this.replace(this.consumptionValues, consumption);
  }

  async adjustment(companyId: CompanyId, id: string) {
    return this.adjustmentValues.find((x) => x.companyId === companyId && x.id === id);
  }

  async adjustmentBySource(companyId: CompanyId, sourceType: string, sourceId: string) {
    return this.adjustmentValues.find(
      (x) => x.companyId === companyId && x.sourceType === sourceType && x.sourceId === sourceId,
    );
  }

  async adjustments(companyId: CompanyId, invoiceId?: string) {
    return this.adjustmentValues.filter(
      (x) => x.companyId === companyId && (!invoiceId || x.invoiceId === invoiceId),
    );
  }

  async saveAdjustment(value: Adjustment) {
    this.replace(this.adjustmentValues, value);
  }

  async saveAdjustmentEffect(value: Adjustment, invoiceBefore: Invoice, invoiceAfter: Invoice, advance?: Advance) {
    const current = this.invoiceValues.find(x=>x.companyId===invoiceBefore.companyId&&x.id===invoiceBefore.id);
    if (!current || current.economicOperationKey || current.outstanding !== invoiceBefore.outstanding || current.status !== invoiceBefore.status || current.recognitionReference !== invoiceBefore.recognitionReference) {
      throw new ContractValidationError('concurrency', 'invoice changed; retry adjustment');
    }
    this.replace(this.invoiceValues, invoiceAfter);
    this.replace(this.adjustmentValues, value);
    if (advance) this.replace(this.advanceValues, advance);
  }
}
