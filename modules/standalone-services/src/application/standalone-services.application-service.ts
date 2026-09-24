import { createHash } from 'node:crypto';
import { ContractValidationError, decimalAmount, type CompanyId, type DecimalAmount } from '@elhafez/contracts';
import type { CommercialSnapshot, DebtorKind, ServiceRevision, ServiceType, StandaloneService, StandaloneServiceCategory } from '../domain/service.js';
import type { StandaloneServicesRepository } from './standalone-services.repository.js';

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
}
function hash(value: unknown): string { return createHash('sha256').update(stable(value)).digest('hex'); }
function required(value: string, field: string): string { if (!value?.trim()) throw new ContractValidationError(field, 'is required'); return value.trim(); }
function units(value: DecimalAmount): bigint { const [whole, fraction = ''] = decimalAmount(value).split('.'); return BigInt(whole! + fraction.padEnd(18, '0')); }
function fromUnits(value: bigint): DecimalAmount { const whole=value/10n**18n; const fraction=value%10n**18n; return decimalAmount(`${whole}${fraction ? `.${fraction.toString().padStart(18,'0').replace(/0+$/,'')}` : ''}`); }
function commercial(currency: string, grossAmount: DecimalAmount, discountAmount: DecimalAmount): CommercialSnapshot {
  required(currency, 'currency'); const gross=units(grossAmount); const discount=units(discountAmount);
  if (gross < 0n || discount < 0n || discount > gross) throw new ContractValidationError('commercial', 'invalid gross/discount');
  return { currency: currency.trim().toUpperCase(), grossAmount: decimalAmount(grossAmount), discountAmount: decimalAmount(discountAmount), netAmount: fromUnits(gross-discount) };
}

export interface CreateServiceDraftInput {
  companyId: CompanyId; branchId: string; commandKey: string; actorId: string; id: string; number: string;
  serviceTypeId: string; serviceDate: string; periodEnd?: string; quantity: DecimalAmount;
  debtorKind: DebtorKind; debtorPartyId: string; customerPartyId: string; beneficiaryPartyIds?: readonly string[];
  details: Readonly<Record<string, unknown>>; currency: string; grossAmount: DecimalAmount; discountAmount: DecimalAmount;
}
export interface UpdateServiceDraftInput extends Omit<CreateServiceDraftInput, 'id'|'number'> { serviceId: string; expectedRevision: number; }
export interface ConfirmationPort {
  prepare(input: { companyId: CompanyId; branchId: string; serviceId: string; revision: number; category: StandaloneServiceCategory; commandKey: string }): Promise<{ ready: boolean; blockers: readonly string[]; planId?: string; planVersion?: number }>;
  commit(input: { companyId: CompanyId; branchId: string; serviceId: string; revision: number; commandKey: string; planId?: string; planVersion?: number }): Promise<{ operationId: string }>;
  cancel(input: { companyId: CompanyId; branchId: string; serviceId: string; revision: number; commandKey: string }): Promise<{ cancelled: boolean; blockers: readonly string[] }>;
}

export class StandaloneServicesApplicationService {
  constructor(private readonly repo: StandaloneServicesRepository, private readonly confirmation: ConfirmationPort) {}

  private async receipt<T extends Readonly<Record<string, unknown>>>(companyId: CompanyId, commandKey: string, payload: unknown, run: () => Promise<T>): Promise<T> {
    required(commandKey, 'commandKey'); const payloadHash=hash(payload); const prior=await this.repo.getReceipt(companyId, commandKey);
    if (prior) { if (prior.payloadHash!==payloadHash) throw new ContractValidationError('commandKey','conflicting replay'); return prior.result as T; }
    const result=await run(); await this.repo.saveReceipt({companyId,commandKey,payloadHash,result}); return result;
  }

  async manageServiceType(input: ServiceType): Promise<ServiceType> {
    required(input.id,'id'); required(input.code,'code'); required(input.nameAr,'nameAr');
    const value={...input,code:input.code.trim().toUpperCase(),nameAr:input.nameAr.trim()}; await this.repo.saveType(value); return value;
  }

  async createDraft(input: CreateServiceDraftInput): Promise<StandaloneService> {
    return this.receipt(input.companyId,input.commandKey,input,async()=>{
      required(input.id,'id'); required(input.branchId,'branchId'); required(input.number,'number'); required(input.actorId,'actorId');
      if (await this.repo.getByNumber(input.companyId,input.branchId,input.number)) throw new ContractValidationError('number','already exists in branch');
      const type=await this.repo.getType(input.companyId,input.serviceTypeId); if(!type?.active) throw new ContractValidationError('serviceTypeId','active service type required');
      const now=new Date().toISOString(); const service:StandaloneService={id:input.id,companyId:input.companyId,branchId:input.branchId,number:input.number,status:'DRAFT',revision:1,createdAt:now,updatedAt:now};
      await this.repo.saveRevision(this.revision(input,type,service.id,1,now)); await this.repo.saveService(service);
      await this.repo.appendHistory({id:hash([service.id,1,'DRAFTED']).slice(0,32),serviceId:service.id,revision:1,kind:'DRAFTED',actorId:input.actorId,createdAt:now});
      return service;
    });
  }

  async updateDraft(input: UpdateServiceDraftInput): Promise<StandaloneService> {
    return this.receipt(input.companyId,input.commandKey,input,async()=>{
      const current=await this.requiredService(input.companyId,input.serviceId); if(current.status!=='DRAFT') throw new ContractValidationError('status','only DRAFT can be edited');
      if(current.revision!==input.expectedRevision) throw new ContractValidationError('expectedRevision','stale service revision');
      const type=await this.repo.getType(input.companyId,input.serviceTypeId); if(!type?.active) throw new ContractValidationError('serviceTypeId','active service type required');
      const now=new Date().toISOString(); const next={...current,revision:current.revision+1,updatedAt:now};
      await this.repo.saveRevision(this.revision(input,type,current.id,next.revision,now)); await this.repo.saveService(next);
      await this.repo.appendHistory({id:hash([current.id,next.revision,'AMENDED']).slice(0,32),serviceId:current.id,revision:next.revision,kind:'AMENDED',actorId:input.actorId,createdAt:now});
      return next;
    });
  }

  async confirm(input:{companyId:CompanyId;branchId:string;serviceId:string;expectedRevision:number;commandKey:string;actorId:string}):Promise<StandaloneService>{
    return this.receipt(input.companyId,input.commandKey,input,async()=>{
      const current=await this.requiredService(input.companyId,input.serviceId); this.assertScope(current,input.branchId);
      if(current.status!=='DRAFT') throw new ContractValidationError('status','service must be DRAFT'); if(current.revision!==input.expectedRevision) throw new ContractValidationError('expectedRevision','stale service revision');
      const revision=await this.requiredRevision(current); const prep=await this.confirmation.prepare({companyId:input.companyId,branchId:input.branchId,serviceId:current.id,revision:current.revision,category:revision.category,commandKey:`${input.commandKey}:prepare`});
      if(!prep.ready) throw new ContractValidationError('confirmation',`blocked: ${prep.blockers.join(',')}`);
      const now=new Date().toISOString(); const confirming={...current,status:'CONFIRMING' as const,updatedAt:now}; await this.repo.saveService(confirming);
      await this.repo.appendHistory({id:hash([current.id,current.revision,'CONFIRMATION_STARTED']).slice(0,32),serviceId:current.id,revision:current.revision,kind:'CONFIRMATION_STARTED',actorId:input.actorId,evidence:{planId:prep.planId??null,planVersion:prep.planVersion??null},createdAt:now});
      const committed=await this.confirmation.commit({companyId:input.companyId,branchId:input.branchId,serviceId:current.id,revision:current.revision,commandKey:`${input.commandKey}:commit`,...(prep.planId?{planId:prep.planId}:{}),...(prep.planVersion!==undefined?{planVersion:prep.planVersion}:{})});
      const done={...confirming,status:'CONFIRMED' as const,confirmedRevision:current.revision,externalOperationId:committed.operationId,updatedAt:new Date().toISOString()}; await this.repo.saveService(done);
      await this.repo.appendHistory({id:hash([current.id,current.revision,'CONFIRMED']).slice(0,32),serviceId:current.id,revision:current.revision,kind:'CONFIRMED',actorId:input.actorId,evidence:{operationId:committed.operationId},createdAt:done.updatedAt}); return done;
    });
  }

  async requestCancellation(input:{companyId:CompanyId;branchId:string;serviceId:string;commandKey:string;actorId:string}):Promise<StandaloneService>{
    return this.receipt(input.companyId,input.commandKey,input,async()=>{
      const current=await this.requiredService(input.companyId,input.serviceId); this.assertScope(current,input.branchId); if(current.status!=='CONFIRMED') throw new ContractValidationError('status','only CONFIRMED can be cancelled');
      const result=await this.confirmation.cancel({companyId:input.companyId,branchId:input.branchId,serviceId:current.id,revision:current.confirmedRevision!,commandKey:`${input.commandKey}:cancel`});
      const now=new Date().toISOString(); if(!result.cancelled){const pending={...current,status:'CANCELLATION_REQUESTED' as const,updatedAt:now};await this.repo.saveService(pending);await this.repo.appendHistory({id:hash([current.id,current.revision,'CANCELLATION_REQUESTED']).slice(0,32),serviceId:current.id,revision:current.revision,kind:'CANCELLATION_REQUESTED',actorId:input.actorId,evidence:{blockers:result.blockers},createdAt:now});return pending;}
      const cancelled={...current,status:'CANCELLED' as const,updatedAt:now};await this.repo.saveService(cancelled);await this.repo.appendHistory({id:hash([current.id,current.revision,'CANCELLED']).slice(0,32),serviceId:current.id,revision:current.revision,kind:'CANCELLED',actorId:input.actorId,createdAt:now});return cancelled;
    });
  }

  async getService(companyId:CompanyId,id:string){const service=await this.requiredService(companyId,id);return {service,revision:await this.requiredRevision(service),history:await this.repo.history(id)};}
  private revision(input:Omit<CreateServiceDraftInput,'id'|'number'>|CreateServiceDraftInput,type:ServiceType,serviceId:string,revision:number,createdAt:string):ServiceRevision{
    const quantity=decimalAmount(input.quantity);if(units(quantity)<=0n)throw new ContractValidationError('quantity','must be positive');required(input.debtorPartyId,'debtorPartyId');required(input.customerPartyId,'customerPartyId');required(input.serviceDate,'serviceDate');
    return {serviceId,revision,serviceTypeId:type.id,category:type.category,serviceDate:input.serviceDate,...(input.periodEnd?{periodEnd:input.periodEnd}:{}),quantity,debtorKind:input.debtorKind,debtorPartyId:input.debtorPartyId,customerPartyId:input.customerPartyId,beneficiaryPartyIds:[...(input.beneficiaryPartyIds??[])],details:{...input.details},commercial:commercial(input.currency,input.grossAmount,input.discountAmount),createdAt};
  }
  private async requiredService(companyId:CompanyId,id:string){const value=await this.repo.getService(companyId,id);if(!value)throw new ContractValidationError('serviceId','service not found');return value;}
  private async requiredRevision(service:StandaloneService){const value=await this.repo.getRevision(service.id,service.revision);if(!value)throw new ContractValidationError('revision','service revision not found');return value;}
  private assertScope(service:StandaloneService,branchId:string){if(service.branchId!==branchId)throw new ContractValidationError('branchId','service belongs to a different branch');}
}
