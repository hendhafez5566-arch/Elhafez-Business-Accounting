/* eslint-disable @typescript-eslint/no-explicit-any */
import {Prisma,type PrismaClient,type BillingFinancialOperation as StoredFinancialOperation} from '@prisma/client';
import {isDeepStrictEqual} from 'node:util';
import {billingUnits,planInvoiceAdjustment} from '../domain/invoice-adjustment-plan.js';
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

export class PrismaBillingRepository implements BillingRepository {
  constructor(private readonly db: PrismaClient) {}

  private financialJson(value:unknown):Prisma.InputJsonValue{return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;}
  private mapFinancialOperation(row:StoredFinancialOperation):BillingFinancialOperation{return{id:row.id,companyId:row.companyId as CompanyId,invoiceId:row.invoiceId,kind:row.kind as BillingFinancialOperation['kind'],sourceType:row.sourceType,sourceId:row.sourceId,requestHash:row.requestHash,snapshot:row.snapshot as unknown as BillingFinancialOperation['snapshot'],...(row.plan!==null?{plan:row.plan}:{}),...(row.result!==null?{result:row.result}:{}),status:row.status as BillingFinancialOperation['status']};}
  async financialOperation(companyId:CompanyId,id:string){const row=await this.db.billingFinancialOperation.findFirst({where:{companyId,id}});return row?this.mapFinancialOperation(row):undefined;}
  async reserveFinancialOperation(input:ReserveBillingFinancialOperation){return this.db.$transaction(async tx=>{
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify([input.companyId,input.sourceType,input.sourceId])},0))::text`);
    const prior=await tx.billingFinancialOperation.findFirst({where:{OR:[{id:input.id},{companyId:input.companyId,sourceType:input.sourceType,sourceId:input.sourceId}]}});
    if(prior){if(prior.companyId!==input.companyId||prior.id!==input.id||prior.requestHash!==input.requestHash)throw new ContractValidationError('operation','conflicting financial operation identity');return this.mapFinancialOperation(prior);}
    await tx.$queryRaw(Prisma.sql`SELECT id FROM billing_invoices WHERE company_id=${input.companyId} AND id=${input.invoiceId} FOR UPDATE`);
    const row=await tx.billingInvoice.findFirst({where:{companyId:input.companyId,id:input.invoiceId},include:{lines:true}});
    if(!row||row.status!=='POSTED'||row.recognitionReference||row.economicOperationKey)throw new ContractValidationError('invoice','posted invoice without pending operation or recognition required');
    const adjustments=await tx.billingAdjustment.findMany({where:{companyId:input.companyId,invoiceId:input.invoiceId}}),snapshot={invoice:this.inv(row),adjustments:adjustments.map(value=>this.adjustmentValue(value)),baseCurrency:input.baseCurrency,basePrecision:input.basePrecision,documentPrecision:input.documentPrecision};
    if(input.kind==='ADJUSTMENT'&&(!input.adjustmentInput||input.adjustmentInput.companyId!==input.companyId||input.adjustmentInput.invoiceId!==input.invoiceId))throw new ContractValidationError('adjustment','scope mismatch');
    const plan=input.kind==='ADJUSTMENT'?planInvoiceAdjustment(snapshot,input.adjustmentInput!):undefined;
    if(input.kind==='ADJUSTMENT_REVERSAL'){
      const adjustment=adjustments.find(x=>x.id===input.reversalAdjustmentId);if(!adjustment||adjustment.reversedAt)throw new ContractValidationError('adjustment','active adjustment required');
      if(adjustment.kind==='DEBIT_NOTE'&&billingUnits(snapshot.invoice.outstanding)<billingUnits(adjustment.appliedAmount.toString()))throw new ContractValidationError('adjustment','BLOCKED: reversal would make outstanding negative');
      if(await tx.billingAllocation.count({where:{companyId:input.companyId,invoiceId:input.invoiceId,reversedAt:null,appliedAmount:{gt:0}}}))throw new ContractValidationError('adjustment','BLOCKED: active downstream invoice allocations');
      const currentCenter=snapshot.invoice.financialDimensions?.currentCostCenterId??snapshot.invoice.lines[0]?.costCenterId;if((adjustment.costCenterId??undefined)!==(currentCenter??undefined))throw new ContractValidationError('dimension','review a current-center adjustment instead of reversing a transferred revenue allocation');
      let advance:Advance|undefined;if(adjustment.advanceId){await tx.$queryRaw(Prisma.sql`SELECT id FROM billing_advances WHERE company_id=${input.companyId} AND id=${adjustment.advanceId} FOR UPDATE`);const value=await tx.billingAdvance.findFirst({where:{companyId:input.companyId,id:adjustment.advanceId}});if(value)advance=this.advanceValue(value);}
      if(advance&&(advance.economicOperationKey||advance.reversedAt||advance.available!==advance.amount))throw new ContractValidationError('adjustment','BLOCKED: generated advance was consumed or reserved');
      Object.assign(snapshot,{reversedAdjustment:this.adjustmentValue(adjustment),...(advance?{generatedAdvance:advance}:{})});
      if(advance)await tx.billingAdvance.update({where:{id:advance.id},data:{economicOperationKey:input.id}});
    }

    const operation=await tx.billingFinancialOperation.create({data:{id:input.id,companyId:input.companyId,invoiceId:input.invoiceId,kind:input.kind,sourceType:input.sourceType,sourceId:input.sourceId,requestHash:input.requestHash,snapshot:this.financialJson(snapshot),...(plan?{plan:this.financialJson(plan)}:{}),status:'PENDING'}});
    await tx.billingInvoice.update({where:{id:input.invoiceId},data:{economicOperationKey:operation.id}});return this.mapFinancialOperation(operation);
  });}
  async setFinancialOperationPlan(companyId:CompanyId,id:string,requestHash:string,plan:unknown){return this.db.$transaction(async tx=>{
    await tx.$queryRaw(Prisma.sql`SELECT id FROM billing_financial_operations WHERE company_id=${companyId} AND id=${id} FOR UPDATE`);const row=await tx.billingFinancialOperation.findFirst({where:{companyId,id}});
    if(!row||row.requestHash!==requestHash)throw new ContractValidationError('operation','reservation missing');const normalized=this.financialJson(plan);
    if(row.plan!==null){if(!isDeepStrictEqual(row.plan,normalized))throw new ContractValidationError('operation','plan changed');return this.mapFinancialOperation(row);}return this.mapFinancialOperation(await tx.billingFinancialOperation.update({where:{id},data:{plan:normalized}}));
  });}
  async completeFinancialOperation(input:CompleteBillingFinancialOperation){return this.db.$transaction(async tx=>{
    await tx.$queryRaw(Prisma.sql`SELECT id FROM billing_financial_operations WHERE company_id=${input.companyId} AND id=${input.id} FOR UPDATE`);const row=await tx.billingFinancialOperation.findFirst({where:{companyId:input.companyId,id:input.id}});
    if(!row||row.requestHash!==input.requestHash)throw new ContractValidationError('operation','reservation missing');const operation=this.mapFinancialOperation(row);if(operation.status==='COMPLETED')return operation;
    await tx.$queryRaw(Prisma.sql`SELECT id FROM billing_invoices WHERE company_id=${input.companyId} AND id=${operation.invoiceId} FOR UPDATE`);const current=await tx.billingInvoice.findFirst({where:{companyId:input.companyId,id:operation.invoiceId}});
    if(!current||current.economicOperationKey!==operation.id||input.invoice.id!==operation.invoiceId||input.invoice.companyId!==input.companyId||current.outstanding.toString()!==operation.snapshot.invoice.outstanding)throw new ContractValidationError('operation','invoice reservation changed');
    const originalAdvance=operation.snapshot.generatedAdvance;if(originalAdvance){const advance=await tx.billingAdvance.findFirst({where:{companyId:input.companyId,id:originalAdvance.id}});if(!advance||advance.economicOperationKey!==operation.id||advance.available.toString()!==originalAdvance.available)throw new ContractValidationError('advance','advance reservation changed');}
    if(input.adjustment&&(input.adjustment.companyId!==input.companyId||input.adjustment.invoiceId!==current.id))throw new ContractValidationError('adjustment','scope mismatch');
    if(input.advance&&(input.advance.companyId!==input.companyId||input.advance.partyId!==current.partyId))throw new ContractValidationError('advance','scope mismatch');
    if(input.adjustment)await this.upsertAdjustment(tx,input.adjustment);if(input.advance)await this.upsertAdvance(tx,input.advance);
    await tx.billingInvoice.update({where:{id:current.id},data:{economicOperationKey:null,outstanding:input.invoice.outstanding,financialDimensions:input.invoice.financialDimensions?this.financialJson(input.invoice.financialDimensions):Prisma.JsonNull}});
    return this.mapFinancialOperation(await tx.billingFinancialOperation.update({where:{id:operation.id},data:{status:'COMPLETED',result:this.financialJson(input.result)}}));
  });}
  private inv(value: any): Invoice {
    return {
      ...value,
      postingDate: value.postingDate.toISOString().slice(0, 10),
      dueDate: value.dueDate?.toISOString().slice(0, 10),
      createdAt: value.createdAt.toISOString(),
      lines: value.lines.map((line: any) => ({
        ...line,
        amount: line.amount.toString(),
        taxAmount: line.taxAmount?.toString(),
      })),
      baseTotal: value.baseTotal.toString(),
      outstanding: value.outstanding.toString(),
    };
  }

  private allocation(value: any): Allocation {
    return {
      ...value,
      amount: value.amount.toString(),
      appliedAmount: value.appliedAmount.toString(),
      advanceAmount: value.advanceAmount.toString(),
      carryingBaseAmount: value.carryingBaseAmount?.toString(),
      settlementBaseAmount: value.settlementBaseAmount?.toString(),
      realizedFx: value.realizedFx?.toString(),
      prefundingBaseAmount: value.prefundingBaseAmount?.toString(),
      reversedAt: value.reversedAt?.toISOString(),
    };
  }

  private advanceValue(value: any): Advance {
    return {
      ...value,
      amount: value.amount.toString(),
      available: value.available.toString(),
      reversedAt: value.reversedAt?.toISOString(),
    };
  }

  private adjustmentValue(value: any): Adjustment {
    return {
      ...value,
      amount: value.amount.toString(),
      appliedAmount: value.appliedAmount.toString(),
      advanceAmount: value.advanceAmount.toString(),
      ...(value.documentAmount!==null&&value.documentAmount!==undefined?{documentAmount:value.documentAmount.toString()}:{}),
      reversedAt: value.reversedAt?.toISOString(),
    };
  }

  private consumptionValue(value: any): AdvanceConsumption {
    return {
      ...value,
      amount: value.amount.toString(),
      reversedAt: value.reversedAt?.toISOString(),
    };
  }

  private async upsertAllocation(db: any, value: Allocation) {
    await db.billingAllocation.upsert({
      where: { companyId_id: { companyId: value.companyId, id: value.id } },
      create: {
        ...value,
        reversedAt: value.reversedAt ? new Date(value.reversedAt) : null,
      },
      update: {
        appliedAmount: value.appliedAmount,
        advanceAmount: value.advanceAmount,
        settlementId: value.settlementId,
        settlementSequence: value.settlementSequence,
        carryingBaseAmount: value.carryingBaseAmount,
        settlementBaseAmount: value.settlementBaseAmount,
        realizedFx: value.realizedFx,
        settlementFxRateId: value.settlementFxRateId,
        prefundingBaseAmount: value.prefundingBaseAmount,
        prefundingAccountId: value.prefundingAccountId,
        reclassificationJournalId: value.reclassificationJournalId,
        reclassificationReversalJournalId: value.reclassificationReversalJournalId,
        requestHash: value.requestHash,
        reversedAt: value.reversedAt ? new Date(value.reversedAt) : null,
      },
    });
  }

  private async upsertAdvance(db: any, value: Advance) {
    await db.billingAdvance.upsert({
      where: { companyId_id: { companyId: value.companyId, id: value.id } },
      create: {
        ...value,
        reversedAt: value.reversedAt ? new Date(value.reversedAt) : null,
      },
      update: {
        economicOperationKey:value.economicOperationKey??null,
        available: value.available,
        reversedAt: value.reversedAt ? new Date(value.reversedAt) : null,
      },
    });
  }

  private async upsertAdjustment(db: any, value: Adjustment) {
    await db.billingAdjustment.upsert({
      where: { companyId_id: { companyId: value.companyId, id: value.id } },
      create: {
        ...value,
        reversedAt: value.reversedAt ? new Date(value.reversedAt) : null,
      },
      update: {
        appliedAmount: value.appliedAmount,
        advanceAmount: value.advanceAmount,
        reversedAt: value.reversedAt ? new Date(value.reversedAt) : null,
        advanceId: value.advanceId,
      },
    });
  }

  async invoice(companyId: CompanyId, id: string) {
    const value = await this.db.billingInvoice.findUnique({
      where: { companyId_id: { companyId, id } },
      include: { lines: true },
    });
    return value ? this.inv(value) : undefined;
  }

  async invoiceBySource(companyId: CompanyId, sourceType: string, sourceId: string) {
    const value = await this.db.billingInvoice.findUnique({
      where: { companyId_sourceType_sourceId: { companyId, sourceType, sourceId } },
      include: { lines: true },
    });
    return value ? this.inv(value) : undefined;
  }

  async supplierExternal(companyId: CompanyId, partyId: string, externalNumber: string) {
    const value = await this.db.billingInvoice.findFirst({
      where: { companyId, type: 'SUPPLIER', partyId, externalInvoiceNumber: externalNumber },
      include: { lines: true },
    });
    return value ? this.inv(value) : undefined;
  }

  async invoices(companyId: CompanyId) {
    return (
      await this.db.billingInvoice.findMany({ where: { companyId }, include: { lines: true } })
    ).map((value) => this.inv(value));
  }

  async saveInvoice(value: Invoice) {
    await this.db.$transaction(async (tx) => {
      await tx.billingInvoice.upsert({
        where: { companyId_id: { companyId: value.companyId, id: value.id } },
        create: {
          ...value,
          postingDate: new Date(value.postingDate),
          dueDate: value.dueDate ? new Date(value.dueDate) : null,
          lines: undefined,
          financialDimensions:value.financialDimensions?this.financialJson(value.financialDimensions):Prisma.JsonNull,
        },
        update: {
          status: value.status,
          baseTotal: value.baseTotal,
          outstanding: value.outstanding,
          fxRateId: value.fxRateId,
          journalId: value.journalId,
          reversalJournalId: value.reversalJournalId,
          recognitionReference: value.recognitionReference,
        },
      });
      for (const line of value.lines) {
        await tx.billingInvoiceLine.upsert({
          where: { companyId_id: { companyId: value.companyId, id: line.id } },
          create: { ...line, companyId: value.companyId, invoiceId: value.id },
          update: {
            taxSnapshotId: line.taxSnapshotId,
            taxAmount: line.taxAmount,
            taxAccountId: line.taxAccountId,
          },
        });
      }
    });
  }

  async startRecognition(companyId: CompanyId, id: string, reference: string) {
    const current = await this.invoice(companyId, id);
    if (!current) throw new ContractValidationError('invoice', 'not found');
    if(current.economicOperationKey)throw new ContractValidationError('invoice','resume pending financial operation first');
    if (!current.deferred || current.status !== 'POSTED') throw new ContractValidationError('invoice', 'posted deferred invoice required');
    if (current.recognitionReference) {
      if (current.recognitionReference === reference) return current;
      throw new ContractValidationError('recognitionReference', 'already recorded');
    }
    const updated = await this.db.billingInvoice.updateMany({
      where: { companyId, id, status: 'POSTED', recognitionReference: null, economicOperationKey:null },
      data: { recognitionReference: reference },
    });
    if (updated.count !== 1) {
      const concurrent = await this.invoice(companyId, id);
      if (concurrent?.recognitionReference === reference) return concurrent;
      throw new ContractValidationError('concurrency', 'invoice changed while recognition started; retry');
    }
    return (await this.invoice(companyId, id))!;
  }

  async markInvoicePosting(companyId: CompanyId, id: string) {
    const current = await this.invoice(companyId, id);
    if (!current) throw new ContractValidationError('invoice', 'not found');
    if (current.status === 'POSTING') return current;
    if (current.status !== 'DRAFT') throw new ContractValidationError('status', 'invoice cannot enter posting');
    const updated = await this.db.billingInvoice.updateMany({
      where: { companyId, id, status: 'DRAFT' },
      data: { status: 'POSTING' },
    });
    if (updated.count !== 1) {
      const concurrent = await this.invoice(companyId, id);
      if (concurrent?.status === 'POSTING') return concurrent;
      throw new ContractValidationError('concurrency', 'invoice posting state changed; retry');
    }
    return (await this.invoice(companyId, id))!;
  }

  async beginCancellation(companyId: CompanyId, id: string) {
    return this.db.$transaction(
      async (tx) => {
        const raw = await tx.billingInvoice.findUnique({
          where: { companyId_id: { companyId, id } },
          include: { lines: true },
        });
        if (!raw) throw new ContractValidationError('invoice', 'not found');
        const current = this.inv(raw);
        if(current.economicOperationKey)throw new ContractValidationError('invoice','resume pending financial operation first');
        if (current.status === 'CANCELLING') return current;
        if (current.status !== 'POSTED') {
          throw new ContractValidationError('status', 'only posted invoice may cancel');
        }
        const [activeAllocations, activeAdjustments] = await Promise.all([
          tx.billingAllocation.count({
            where: {
              companyId,
              invoiceId: id,
              reversedAt: null,
              appliedAmount: { gt: 0 },
            },
          }),
          tx.billingAdjustment.count({
            where: { companyId, invoiceId: id, reversedAt: null },
          }),
        ]);
        if (activeAllocations > 0 || activeAdjustments > 0) {
          throw new ContractValidationError('invoice', 'BLOCKED: active downstream billing effects');
        }
        const updated = await tx.billingInvoice.updateMany({
          where: { companyId, id, status: 'POSTED', economicOperationKey:null },
          data: { status: 'CANCELLING' },
        });
        if (updated.count !== 1) {
          throw new ContractValidationError('concurrency', 'invoice changed while cancelling; retry');
        }
        return { ...current, status: 'CANCELLING' as const };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async finalizeInvoicePosting(value: Invoice, allocations: readonly Allocation[], advances: readonly Advance[]) {
    await this.db.$transaction(
      async (tx) => {
        const updated = await tx.billingInvoice.updateMany({
          where: { companyId: value.companyId, id: value.id, status: 'POSTING' },
          data: {
            status: value.status,
            baseTotal: value.baseTotal,
            outstanding: value.outstanding,
            fxRateId: value.fxRateId,
            journalId: value.journalId,
          },
        });
        if (updated.count !== 1) {
          throw new ContractValidationError('concurrency', 'invoice changed while posting; retry');
        }
        for (const line of value.lines) {
          await tx.billingInvoiceLine.update({
            where: { companyId_id: { companyId: value.companyId, id: line.id } },
            data: {
              taxSnapshotId: line.taxSnapshotId,
              taxAmount: line.taxAmount,
              taxAccountId: line.taxAccountId,
            },
          });
        }
        for (const allocation of allocations) await this.upsertAllocation(tx, allocation);
        for (const advance of advances) await this.upsertAdvance(tx, advance);
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async saveCreditLimit(companyId: CompanyId, partyId: string, amount: DecimalAmount) {
    await this.db.billingCreditLimit.upsert({
      where: { companyId_partyId: { companyId, partyId } },
      create: { companyId, partyId, amount },
      update: { amount },
    });
  }

  async creditLimit(companyId: CompanyId, partyId: string) {
    const value = await this.db.billingCreditLimit.findUnique({
      where: { companyId_partyId: { companyId, partyId } },
    });
    return value?.amount.toString() as DecimalAmount | undefined;
  }

  async allocationBySource(companyId: CompanyId, sourceType: string, sourceId: string) {
    const value = await this.db.billingAllocation.findUnique({
      where: { companyId_sourceType_sourceId: { companyId, sourceType, sourceId } },
    });
    return value ? this.allocation(value) : undefined;
  }

  async saveAllocation(value: Allocation) {
    await this.upsertAllocation(this.db, value);
  }

  async saveAllocationEffect(value: Allocation, invoiceBefore?: Invoice, invoiceAfter?: Invoice, advance?: Advance) {
    await this.db.$transaction(
      async (tx) => {
        if ((invoiceBefore === undefined) !== (invoiceAfter === undefined)) {
          throw new ContractValidationError('invoice', 'allocation effect requires both invoice states');
        }
        if (invoiceBefore && invoiceAfter) {
          const updated = await tx.billingInvoice.updateMany({
            where: {
              companyId: invoiceBefore.companyId,
              id: invoiceBefore.id,
              status: invoiceBefore.status,
              outstanding: invoiceBefore.outstanding,
              economicOperationKey:null,
              recognitionReference: invoiceBefore.recognitionReference ?? null,
            },
            data: { outstanding: invoiceAfter.outstanding },
          });
          if (updated.count !== 1) {
            throw new ContractValidationError('concurrency', 'invoice changed; retry allocation');
          }
        }
        await this.upsertAllocation(tx, value);
        if (advance) await this.upsertAdvance(tx, advance);
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async allocations(companyId: CompanyId, invoiceId?: string) {
    return (
      await this.db.billingAllocation.findMany({
        where: { companyId, ...(invoiceId ? { invoiceId } : {}) },
      })
    ).map((value) => this.allocation(value));
  }

  async advance(companyId: CompanyId, id: string) {
    const value = await this.db.billingAdvance.findUnique({
      where: { companyId_id: { companyId, id } },
    });
    return value ? this.advanceValue(value) : undefined;
  }

  async advances(companyId: CompanyId, partyKind: PartyKind, partyId: string) {
    return (
      await this.db.billingAdvance.findMany({ where: { companyId, partyKind, partyId } })
    ).map((value) => this.advanceValue(value));
  }

  async saveAdvance(value: Advance) {
    await this.upsertAdvance(this.db, value);
  }

  async consumptionBySource(companyId: CompanyId, sourceType: string, sourceId: string) {
    const value = await this.db.billingAdvanceConsumption.findUnique({
      where: { companyId_sourceType_sourceId: { companyId, sourceType, sourceId } },
    });
    return value ? this.consumptionValue(value) : undefined;
  }

  async completeAdvanceConsumption(companyId: CompanyId, sourceType: string, sourceId: string, evidence: NonNullable<AdvanceConsumption['evidence']>) {
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM billing_advance_consumptions WHERE company_id=${companyId} AND source_type=${sourceType} AND source_id=${sourceId} FOR UPDATE`;
      const current = await tx.billingAdvanceConsumption.findUnique({where:{companyId_sourceType_sourceId:{companyId, sourceType, sourceId}}});
      if (!current || current.reversedAt) throw new ContractValidationError('consumption', 'active refund reservation required');
      if (current.status === 'POSTED') {
        if (!isDeepStrictEqual(current.evidence, this.financialJson(evidence))) throw new ContractValidationError('evidence', 'conflicting refund completion replay');
        return this.consumptionValue(current);
      }
      if (current.status !== 'RESERVED') throw new ContractValidationError('consumption', 'refund reservation required');
      return this.consumptionValue(await tx.billingAdvanceConsumption.update({where:{companyId_id:{companyId,id:current.id}},data:{status:'POSTED',evidence:this.financialJson(evidence)}}));
    });
  }

  async saveAdvanceConsumptionEffect(
    consumption: AdvanceConsumption,
    advanceBefore: Advance,
    advanceAfter: Advance,
  ) {
    await this.db.$transaction(
      async (tx) => {
        const updated = await tx.billingAdvance.updateMany({
          where: {
            companyId: advanceBefore.companyId,
            id: advanceBefore.id,
            available: advanceBefore.available,
            economicOperationKey:null,
            reversedAt: advanceBefore.reversedAt ? new Date(advanceBefore.reversedAt) : null,
          },
          data: {
            available: advanceAfter.available,
            reversedAt: advanceAfter.reversedAt ? new Date(advanceAfter.reversedAt) : null,
          },
        });
        if (updated.count !== 1) {
          throw new ContractValidationError('concurrency', 'advance changed; retry consumption');
        }
        await tx.billingAdvanceConsumption.create({
          data: {
            ...consumption,
            evidence: consumption.evidence ? this.financialJson(consumption.evidence) : undefined,
            reversedAt: consumption.reversedAt ? new Date(consumption.reversedAt) : null,
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async adjustment(companyId: CompanyId, id: string) {
    const value = await this.db.billingAdjustment.findUnique({
      where: { companyId_id: { companyId, id } },
    });
    return value ? this.adjustmentValue(value) : undefined;
  }

  async adjustmentBySource(companyId: CompanyId, sourceType: string, sourceId: string) {
    const value = await this.db.billingAdjustment.findUnique({
      where: { companyId_sourceType_sourceId: { companyId, sourceType, sourceId } },
    });
    return value ? this.adjustmentValue(value) : undefined;
  }

  async adjustments(companyId: CompanyId, invoiceId?: string) {
    return (
      await this.db.billingAdjustment.findMany({
        where: { companyId, ...(invoiceId ? { invoiceId } : {}) },
      })
    ).map((value) => this.adjustmentValue(value));
  }

  async saveAdjustment(value: Adjustment) {
    await this.upsertAdjustment(this.db, value);
  }

  async saveAdjustmentEffect(value: Adjustment, invoiceBefore: Invoice, invoiceAfter: Invoice, advance?: Advance) {
    await this.db.$transaction(
      async (tx) => {
        const updated = await tx.billingInvoice.updateMany({
          where: {
            companyId: invoiceBefore.companyId,
            id: invoiceBefore.id,
            status: invoiceBefore.status,
            outstanding: invoiceBefore.outstanding,
          },
          data: { outstanding: invoiceAfter.outstanding },
        });
        if (updated.count !== 1) {
          throw new ContractValidationError('concurrency', 'invoice changed; retry adjustment');
        }
        await this.upsertAdjustment(tx, value);
        if (advance) await this.upsertAdvance(tx, advance);
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
