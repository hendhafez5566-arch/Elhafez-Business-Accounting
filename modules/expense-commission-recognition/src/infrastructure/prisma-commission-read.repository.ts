import { decimalAmount, type CompanyId } from '@elhafez/contracts';
import type { PrismaClient } from '@prisma/client';
import type { CommissionReadRepository } from '../application/commission-read.repository.js';
import type { CommissionClaim, CommissionPayment } from '../domain/ecr.js';

function mapPayment(value:{id:string;requestHash:string;status:string;amount:{toString():string};paymentCurrency:string;claimAmountApplied:{toString():string};claimFxRateId:string|null;settlementBaseAmount:{toString():string};carryingBaseAmount:{toString():string};realizedFx:{toString():string};fxRateId:string|null;treasuryVoucherId:string|null}):CommissionPayment{
  return {id:value.id,requestHash:value.requestHash,status:value.status as CommissionPayment['status'],amount:decimalAmount(value.amount.toString()),paymentCurrency:value.paymentCurrency,claimAmountApplied:decimalAmount(value.claimAmountApplied.toString()),...(value.claimFxRateId?{claimFxRateId:value.claimFxRateId}:{}),settlementBaseAmount:decimalAmount(value.settlementBaseAmount.toString()),carryingBaseAmount:decimalAmount(value.carryingBaseAmount.toString()),realizedFx:decimalAmount(value.realizedFx.toString()),...(value.fxRateId?{fxRateId:value.fxRateId}:{}),...(value.treasuryVoucherId?{treasuryVoucherId:value.treasuryVoucherId}:{})};
}

export class PrismaCommissionReadRepository implements CommissionReadRepository {
  constructor(private readonly prisma:PrismaClient){}
  async list(companyId:CompanyId,agentPartyId?:string):Promise<CommissionClaim[]>{
    const rows=await this.prisma.ecrCommissionClaim.findMany({where:{companyId,...(agentPartyId?{agentPartyId}:{})},include:{payments:true},orderBy:{id:'desc'}});
    return rows.map(value=>({id:value.id,companyId:value.companyId as CompanyId,...(value.branchId?{branchId:value.branchId}:{}),agentPartyId:value.agentPartyId,sourceType:value.sourceType,sourceId:value.sourceId,currency:value.currency,amount:decimalAmount(value.amount.toString()),baseCarryingAmount:decimalAmount(value.baseCarryingAmount.toString()),status:value.status as CommissionClaim['status'],requestHash:value.requestHash,...(value.approvalRequestId?{approvalRequestId:value.approvalRequestId}:{}),...(value.requesterActorId?{requesterActorId:value.requesterActorId}:{}),...(value.recognitionJournalId?{recognitionJournalId:value.recognitionJournalId}:{}),...(value.reversalJournalId?{reversalJournalId:value.reversalJournalId}:{}),expenseAccountId:value.expenseAccountId,liabilityAccountId:value.liabilityAccountId,payments:value.payments.map(mapPayment)}));
  }
}
