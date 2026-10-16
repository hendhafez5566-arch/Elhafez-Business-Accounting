import {normalizeFinancialResponsibilities,type FinancialResponsibility} from '../domain/financial-responsibilities.js';
import { createHash, randomUUID } from 'node:crypto';
import { ContractValidationError, decimalAmount, type ExecutionContext, type SourceReference } from '@elhafez/contracts';
import type {BookingAgentChangeInput, Booking, BookingHistory, BookingStatus } from '../domain/booking.js';
import type { BookingRepository } from './booking.repository.js';
import type {
  BookingAgentChangeProposal, BookingAccess, BookingAgentPort, BookingCustomerPort, BookingFinanceInventoryRequest,
  BookingFinancePort, BookingProgramPort, BookingTravelerPort,
} from './booking.ports.js';

export const BOOKING_PERMISSIONS = Object.freeze({
  view: 'hajj_umrah.bookings.view',
  manage: 'hajj_umrah.bookings.manage',
  confirm: 'hajj_umrah.bookings.confirm',
  lifecycle: 'hajj_umrah.bookings.lifecycle',
  cancel: 'hajj_umrah.bookings.cancel',
});

export interface CreateBookingInput {
  readonly requestId?:string;
  readonly code: string;
  readonly programId: string;
  readonly customerId: string;
  readonly financialCustomerId?: string;
  readonly familyReference?: string;
  readonly agentId?: string;
  readonly travelerIds: readonly string[];
  readonly sourceReference?: SourceReference;
}
export interface ConfirmOperationalBookingInput {
  readonly employeeCommission?:{employeeId:string;partyId:string;amount:string};
  readonly financialResponsibilities?:readonly FinancialResponsibility[];
  readonly requireStock?:boolean;
  readonly commandKey: string;
  readonly category: 'HOTEL'|'FLIGHT'|'TRANSPORT'|'VISA'|'OTHER';
  readonly costCenterId: string;
  readonly currency: string;
  readonly grossAmount: string;
  readonly discountAmount: string;
  readonly approvalRequestId?: string;
  readonly postingDate: string;
  readonly dueDate: string;
  readonly invoiceNumber: string;
  readonly inventories: readonly BookingFinanceInventoryRequest[];
  readonly commissionAmount?: string;
}
export interface CancelOperationalBookingInput {
  readonly commandKey: string;
  readonly postingDate: string;
  readonly reason: string;
}

const required=(value:string,field:string)=>{const v=value.trim();if(!v)throw new ContractValidationError(field,'is required');return v;};
function ordered(value:unknown):unknown{if(Array.isArray(value))return value.map(ordered);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,ordered(item)]));return value;}
const unique=(values:readonly string[])=>[...new Set(values.map(v=>required(v,'travelerId')))];

export class HajjUmrahBookingsApplicationService {
  constructor(
    private readonly repo: BookingRepository,
    private readonly access: BookingAccess,
    private readonly programs: BookingProgramPort,
    private readonly travelers: BookingTravelerPort,
    private readonly customers: BookingCustomerPort,
    private readonly agents: BookingAgentPort,
    private readonly finance: BookingFinancePort,
    private readonly now:()=>Date=()=>new Date(),
    private readonly id:()=>string=()=>randomUUID(),
  ) {}

  private async permission(c:ExecutionContext,p:string){await this.access.requireBranch(c);await this.access.requirePermission(c,p);}
  private history(c:ExecutionContext,b:string,action:string,from?:BookingStatus,to?:BookingStatus,reason?:string,evidence?:unknown):BookingHistory{
    return {id:this.id(),companyId:c.companyId,branchId:c.branchId,bookingId:b,action,...(from?{fromStatus:from}:{}),...(to?{toStatus:to}:{}),...(reason?{reason}:{}),...(evidence===undefined?{}:{evidence}),actorId:c.actorId,occurredAt:this.now().toISOString()};
  }
  private async required(c:ExecutionContext,id:string){const v=await this.repo.get(c.companyId,c.branchId,id);if(!v)throw new ContractValidationError('bookingId','booking not found');return v;}

  async create(c:ExecutionContext,input:CreateBookingInput):Promise<Booking>{
    await this.permission(c,BOOKING_PERMISSIONS.manage);
    const program=await this.programs.require(c,required(input.programId,'programId'));
    const customer=await this.customers.requireActive(c,required(input.customerId,'customerId'));
    const travelerIds=unique(input.travelerIds);
    if(!travelerIds.length)throw new ContractValidationError('travelerIds','at least one traveler is required');
    // Traveler identity is independent of the contracting customer and debtor.
    for(const id of travelerIds)await this.travelers.requireActive(c,id);
    const debtor=input.financialCustomerId?await this.customers.requireActive(c,required(input.financialCustomerId,'financialCustomerId')):customer;
    const familyReference=input.familyReference===undefined?undefined:required(input.familyReference,'familyReference');
    const agent=input.agentId?await this.agents.requireActive(c,input.agentId):undefined;
    const commissionAgreement=agent&&this.agents.snapshot?await this.agents.snapshot(c,agent.id):null;
    if(input.requestId!==undefined&&!/^[A-Za-z0-9][A-Za-z0-9_-]{15,127}$/.test(input.requestId))throw new ContractValidationError('requestId','stable request identity required');
    const createRequestHash=createHash('sha256').update(JSON.stringify({code:input.code.trim(),programId:program.id,customerId:customer.id,financialCustomerId:debtor.id,familyReference:familyReference??null,agentId:agent?.id??null,travelerIds:[...travelerIds].sort(),sourceReference:input.sourceReference??null})).digest('hex');
    const at=this.now().toISOString(),id=input.requestId?createHash('sha256').update(JSON.stringify([c.companyId,c.branchId,input.requestId])).digest('hex').slice(0,32):this.id();
    const value:Booking={...(input.requestId?{createRequestId:input.requestId,createRequestHash}:{}),...(commissionAgreement?{commissionAgreement}:{}),id,companyId:c.companyId,branchId:c.branchId,code:required(input.code,'code'),programId:program.id,customerId:customer.id,customerPartyId:customer.partyId,financialCustomerId:debtor.id,financialPartyId:debtor.partyId,...(familyReference?{familyReference}:{}),...(agent?{agentId:agent.id,agentPartyId:agent.partyId}:{}),travelerIds,status:'PRELIMINARY',financialState:'UNCONFIRMED',allocationIds:[],...(input.sourceReference?{sourceReference:input.sourceReference}:{}),createdAt:at,updatedAt:at};
    let saved:Booking;
    try{saved=await this.repo.create(value,this.history(c,id,'CREATED',undefined,'PRELIMINARY'));}
    catch(error){
      const prior=input.requestId?await this.repo.get(c.companyId,c.branchId,id):null;
      if(!prior)throw error;
      if(prior.createRequestHash!==createRequestHash)throw new ContractValidationError('requestId','conflicting booking creation replay');
      saved=prior;
    }
    await this.customers.register(c,customer.id,id);
    if(debtor.id!==customer.id)await this.customers.register(c,debtor.id,id);
    if(agent)await this.agents.register(c,agent.id,id);
    await this.access.audit(c,'hajj-umrah.booking.created',id,{programId:program.id,travelerCount:travelerIds.length});
    return saved;
  }

  async get(c:ExecutionContext,id:string){await this.permission(c,BOOKING_PERMISSIONS.view);return this.required(c,id);}
  async listForProgramForIntegration(c:ExecutionContext,programId:string){await this.access.requireBranch(c);return(await this.repo.list(c.companyId,c.branchId)).filter(value=>value.programId===programId)}
 async list(c:ExecutionContext){await this.permission(c,BOOKING_PERMISSIONS.view);return this.repo.list(c.companyId,c.branchId);}
  async historyFor(c:ExecutionContext,id:string){await this.permission(c,BOOKING_PERMISSIONS.view);await this.required(c,id);return this.repo.history(c.companyId,c.branchId,id);}

  async requireForIntegration(c:ExecutionContext,id:string){await this.access.requireBranch(c);return this.required(c,id);}
  async requireOperationalTravelerForIntegration(c:ExecutionContext,id:string,travelerId:string){
    await this.access.requireBranch(c);const b=await this.required(c,id);
    if(b.status==='CANCELLED'||b.status==='COMPLETED')throw new ContractValidationError('bookingId','booking is not operational');
    if(!b.travelerIds.includes(travelerId))throw new ContractValidationError('travelerId','traveler does not belong to booking');
    return b;
  }

  async placeHold(c:ExecutionContext,id:string,input:{requestId:string;expiresAt:string;inventory:BookingFinanceInventoryRequest}){
    await this.permission(c,BOOKING_PERMISSIONS.manage);let old=await this.required(c,id);
    if(old.status!=='PRELIMINARY'||old.confirmationCommandKey)throw new ContractValidationError('status','temporary hold requires preliminary booking');
    if(!/^[A-Za-z0-9_-]{16,128}$/.test(input.requestId))throw new ContractValidationError('requestId','stable hold identity required');
    const program=await this.programs.require(c,old.programId);if(program.status!=='BOOKABLE'||!program.bookingOpen)throw new ContractValidationError('program','open booking program required');
    const commandKey='booking-hold:'+input.requestId,hash=createHash('sha256').update(JSON.stringify(ordered({expiresAt:input.expiresAt,inventory:input.inventory}))).digest('hex');
    if(old.capacityHold&&old.capacityHold.state!=='RELEASED'){
      if(old.capacityHold.commandKey!==commandKey||old.capacityHold.hash!==hash)throw new ContractValidationError('hold','resume or explicitly release the existing hold');
      if(old.capacityHold.state==='HELD')return old;
    }else{
      const expiry=Date.parse(input.expiresAt);if(!Number.isFinite(expiry)||expiry<=this.now().getTime()||expiry>this.now().getTime()+7*86400000)throw new ContractValidationError('expiresAt','deadline within seven days required');
      old=await this.repo.save({...old,capacityHold:{commandKey,hash,expiresAt:input.expiresAt,inventory:input.inventory,state:'REQUESTED'},updatedAt:this.now().toISOString()},this.history(c,id,'HOLD_REQUESTED','PRELIMINARY','PRELIMINARY',undefined,{commandKey,expiresAt:input.expiresAt}));
    }
    if(!this.finance.hold)throw new ContractValidationError('hold','capacity coordination is unavailable');
    const evidence=await this.finance.hold({companyId:c.companyId,branchId:c.branchId,commandKey,bookingId:id,programId:old.programId,expiresAt:input.expiresAt,inventory:input.inventory});
    const next={...old,capacityHold:{...old.capacityHold!,state:'HELD' as const,evidence},updatedAt:this.now().toISOString()};
    return this.repo.save(next,this.history(c,id,'CAPACITY_HELD','PRELIMINARY','PRELIMINARY',undefined,evidence));
  }
  async extendHold(c:ExecutionContext,id:string,expiresAt:string,reason:string){
    await this.permission(c,BOOKING_PERMISSIONS.manage);const old=await this.required(c,id),expiry=Date.parse(expiresAt);required(reason,'reason');
    if(old.status!=='PRELIMINARY'||old.confirmationCommandKey||old.capacityHold?.state!=='HELD')throw new ContractValidationError('hold','held preliminary booking required');
    if(!Number.isFinite(expiry)||expiry<=this.now().getTime()||expiry>this.now().getTime()+7*86400000||expiry<=Date.parse(old.capacityHold.expiresAt))throw new ContractValidationError('expiresAt','a later deadline within seven days is required');
    return this.repo.save({...old,capacityHold:{...old.capacityHold,expiresAt},updatedAt:this.now().toISOString()},this.history(c,id,'CAPACITY_HOLD_EXTENDED','PRELIMINARY','PRELIMINARY',reason,{previousDeadline:old.capacityHold.expiresAt,expiresAt}));
  }
  async releaseHold(c:ExecutionContext,id:string,reason:string){
    await this.permission(c,BOOKING_PERMISSIONS.manage);const old=await this.required(c,id);required(reason,'reason');
    if(old.status!=='PRELIMINARY'||old.confirmationCommandKey||!old.capacityHold)throw new ContractValidationError('hold','preliminary held booking required');if(old.capacityHold.state==='RELEASED')return old;
    if(!this.finance.releaseHold)throw new ContractValidationError('hold','capacity coordination is unavailable');
    const evidence=await this.finance.releaseHold({companyId:c.companyId,branchId:c.branchId,bookingId:id,capacityHoldKey:old.capacityHold.commandKey});
    return this.repo.save({...old,capacityHold:{...old.capacityHold,state:'RELEASED'},updatedAt:this.now().toISOString()},this.history(c,id,'CAPACITY_HOLD_RELEASED','PRELIMINARY','PRELIMINARY',reason,evidence));
  }
  async confirm(c:ExecutionContext,id:string,input:ConfirmOperationalBookingInput){
    await this.permission(c,BOOKING_PERMISSIONS.confirm);
    let old=await this.required(c,id);
    const responsibilities=input.financialResponsibilities?normalizeFinancialResponsibilities(input.financialResponsibilities,old.travelerIds,input.grossAmount,input.discountAmount):undefined;
    const normalized=responsibilities?{...input,financialResponsibilities:responsibilities}:input;
    const payloadHash=this.confirmationHash(normalized);
    if(old.status!=='PRELIMINARY'){
      if(old.confirmationCommandKey===input.commandKey&&old.confirmationPayloadHash===payloadHash)return old;
      throw new ContractValidationError('commandKey','conflicting booking confirmation replay');
    }
    if(old.capacityHold&&old.capacityHold.state==='REQUESTED')throw new ContractValidationError('hold','resume the original hold before confirmation');
    const program=await this.programs.require(c,old.programId);
    if(program.status!=='BOOKABLE'||!program.bookingOpen)throw new ContractValidationError('programId','program is not open for booking');
    for(const travelerId of old.travelerIds)await this.travelers.requireActive(c,travelerId);
    const customerCharges=[] as Array<FinancialResponsibility & {partyId:string}>;
    if(responsibilities)for(const responsibility of responsibilities){const customer=await this.customers.requireActive(c,responsibility.financialCustomerId);customerCharges.push({...responsibility,partyId:customer.partyId});}
    if(old.confirmationCommandKey&&(old.confirmationCommandKey!==input.commandKey||old.confirmationPayloadHash!==payloadHash))throw new ContractValidationError('commandKey','conflicting pending confirmation; resume the original request');
    if(input.employeeCommission){await this.access.requirePermission(c,'accounting.finance.operate');if(!this.finance.validateEmployeeCommission)throw new ContractValidationError('employee','identity provider required');await this.finance.validateEmployeeCommission(c,input.employeeCommission.employeeId,input.employeeCommission.partyId);}
    if(!old.confirmationCommandKey){
      try{old=await this.repo.save({...old,confirmationCommandKey:required(input.commandKey,'commandKey'),confirmationPayloadHash:payloadHash,updatedAt:this.now().toISOString()},this.history(c,id,'CONFIRMATION_REQUESTED',undefined,undefined,undefined,{commandKey:input.commandKey,payloadHash}));}
      catch(error){const current=await this.required(c,id);if(current.confirmationCommandKey!==input.commandKey||current.confirmationPayloadHash!==payloadHash)throw error;if(current.status==='CONFIRMED')return current;old=current;}
    }
    const evidence=await this.finance.confirm({
      context:c,...(input.employeeCommission?{employeeCommission:input.employeeCommission}:{}),
      ...(responsibilities?{customerCharges}:{}),
      ...(old.capacityHold?.state==='HELD'?{capacityHoldKey:old.capacityHold.commandKey}:{}),requireStock:input.requireStock,companyId:c.companyId,branchId:c.branchId,commandKey:required(input.commandKey,'commandKey'),bookingId:old.id,programId:program.id,
      programEvidence:`HUP:${program.id}:${program.currentVersionId}:BOOKABLE:OPEN`,category:input.category,costCenterId:required(input.costCenterId,'costCenterId'),
      customerPartyId:old.financialPartyId??old.customerPartyId,currency:required(input.currency,'currency'),grossAmount:input.grossAmount,discountAmount:input.discountAmount,
      ...(input.approvalRequestId?{approvalRequestId:input.approvalRequestId}:{}),postingDate:required(input.postingDate,'postingDate'),dueDate:required(input.dueDate,'dueDate'),
      invoiceNumber:required(input.invoiceNumber,'invoiceNumber'),inventories:input.inventories,
      ...(old.agentPartyId&&input.commissionAmount?{commission:{agentPartyId:old.agentPartyId,amount:input.commissionAmount,...(old.commissionAgreement?{agreement:old.commissionAgreement}:{})}}:{}),
    });
    const allocationIds=this.extractAllocationIds(evidence);
    const next:Booking={...old,...(old.capacityHold?.state==='HELD'?{capacityHold:{...old.capacityHold,state:'ADOPTED' as const}}:{}),status:'CONFIRMED',financialState:'CONFIRMED',allocationIds,confirmationCommandKey:input.commandKey,confirmationPayloadHash:payloadHash,financialEvidence:evidence,updatedAt:this.now().toISOString()};
    let saved:Booking;
    try{saved=await this.repo.save(next,this.history(c,id,'CONFIRMED','PRELIMINARY','CONFIRMED',undefined,evidence));}
    catch(error){const current=await this.repo.get(c.companyId,c.branchId,id);if(current?.status==='CONFIRMED'&&current.confirmationCommandKey===input.commandKey&&current.confirmationPayloadHash===payloadHash)return current;throw error;}
    await this.access.audit(c,'hajj-umrah.booking.confirmed',id,{allocationIds});
    return saved;
  }

  async prepareAgentChange(c:ExecutionContext,id:string,newAgentId?:string):Promise<BookingAgentChangeProposal>{
    await this.permission(c,BOOKING_PERMISSIONS.manage);await this.access.requirePermission(c,'accounting.finance.read');const old=await this.required(c,id);
    if(!['CONFIRMED','READY'].includes(old.status)||old.financialMutation?.state==='PENDING')throw new ContractValidationError('booking','confirmed pre-travel booking without a pending mutation required');
    if(!this.finance.prepareAgentChange)throw new ContractValidationError('commission','proposal provider required');const proposal=await this.finance.prepareAgentChange({companyId:c.companyId,branchId:c.branchId,bookingId:id});if(newAgentId){const agent=await this.agents.requireActive(c,newAgentId),agreement=this.agents.snapshot?await this.agents.snapshot(c,agent.id):null;return{...proposal,newAgentAgreement:agreement};}return{...proposal,newAgentAgreement:undefined};
  }
  async changeAgent(c:ExecutionContext,id:string,input:BookingAgentChangeInput):Promise<Booking>{
    await this.permission(c,BOOKING_PERMISSIONS.manage);await this.access.requirePermission(c,'accounting.finance.operate');if(!this.finance.changeAgent)throw new ContractValidationError('commission','settlement provider required');
    if(input.reviewed!==true)throw new ContractValidationError('reviewed','explicit review of unpaid balances and selected agreement required');
    const normalized={...input,commandKey:required(input.commandKey,'commandKey'),newAgentId:required(input.newAgentId,'newAgentId'),reason:required(input.reason,'reason'),expectedRemaining:input.expectedRemaining.map(x=>({claimId:required(x.claimId,'claimId'),amount:decimalAmount(x.amount)})).sort((a,b)=>a.claimId.localeCompare(b.claimId))};
    if(normalized.reason.length<10)throw new ContractValidationError('reason','at least ten characters required');const payloadHash=createHash('sha256').update(JSON.stringify(ordered(normalized))).digest('hex');let old=await this.required(c,id);
    const completed=(await this.repo.history(c.companyId,c.branchId,id)).find(x=>['AGENT_CHANGED','AGENT_CHANGE_REJECTED'].includes(x.action)&&(x.evidence as {commandKey?:string}|undefined)?.commandKey===normalized.commandKey);
    if(completed){if((completed.evidence as {payloadHash?:string}).payloadHash!==payloadHash)throw new ContractValidationError('commandKey','conflicting agent change replay');return old;}
    if(!['CONFIRMED','READY'].includes(old.status))throw new ContractValidationError('status','agent changes require a confirmed pre-travel booking');
    if(old.financialMutation?.state==='PENDING'&&(old.financialMutation.kind!=='AGENT_CHANGE'||old.financialMutation.commandKey!==normalized.commandKey||old.financialMutation.payloadHash!==payloadHash))throw new ContractValidationError('booking','resume the pending financial operation first');
    if(old.financialMutation?.state!=='PENDING'){
      const agent=await this.agents.requireActive(c,normalized.newAgentId);if(agent.id===old.agentId)throw new ContractValidationError('newAgentId','select a different agent');const agreement=this.agents.snapshot?await this.agents.snapshot(c,agent.id):null;
      if((normalized.expectedAgreement?.agreementId??null)!==(agreement?.agreementId??null)||(normalized.expectedAgreement?.agreementVersion??null)!==(agreement?.agreementVersion??null))throw new ContractValidationError('agreement','agreement changed; review it again before settlement');
      const mutation={kind:'AGENT_CHANGE' as const,input:normalized,agentSnapshot:{id:agent.id,partyId:agent.partyId,...(agreement?{agreement}:{})},commandKey:normalized.commandKey,payloadHash,actorId:c.actorId,state:'PENDING' as const};
      try{old=await this.repo.save({...old,financialMutation:mutation,updatedAt:this.now().toISOString()},this.history(c,id,'AGENT_CHANGE_REQUESTED',old.status,old.status,normalized.reason,{commandKey:normalized.commandKey,payloadHash,previousAgentId:old.agentId??null,newAgentId:agent.id}));}
      catch(error){const current=await this.required(c,id);if(current.financialMutation?.kind!=='AGENT_CHANGE'||current.financialMutation.commandKey!==normalized.commandKey||current.financialMutation.payloadHash!==payloadHash)throw error;old=current;}
    }
    let mutation=old.financialMutation;if(mutation?.kind!=='AGENT_CHANGE')throw new ContractValidationError('booking','agent change reservation missing');
    if(!mutation.referenceRegistered){
      await this.agents.register(c,mutation.agentSnapshot.id,id);
      try{old=await this.repo.save({...old,financialMutation:{...mutation,referenceRegistered:true},updatedAt:this.now().toISOString()},this.history(c,id,'AGENT_CHANGE_REFERENCE_LINKED',old.status,old.status,normalized.reason,{commandKey:normalized.commandKey}));}
      catch(error){const current=await this.required(c,id);if(current.financialMutation?.kind!=='AGENT_CHANGE'||current.financialMutation.commandKey!==normalized.commandKey||!current.financialMutation.referenceRegistered)throw error;old=current;}
      mutation=old.financialMutation;if(mutation?.kind!=='AGENT_CHANGE')throw new ContractValidationError('booking','agent change reservation missing');
    }
    const evidence=await this.finance.changeAgent({context:c,bookingId:id,commandKey:normalized.commandKey,newAgentPartyId:mutation.agentSnapshot.partyId,...(mutation.agentSnapshot.agreement?{agreement:mutation.agentSnapshot.agreement}:{}),expectedRemaining:normalized.expectedRemaining,currency:normalized.currency,reason:normalized.reason,postingDate:normalized.postingDate,number:normalized.number});
    const changed=(evidence as {changed?:boolean}|null)?.changed!==false,{commissionAgreement:previousAgreement,...rest}=old;void previousAgreement;
    const next:Booking={...rest,...(changed?{agentId:mutation.agentSnapshot.id,agentPartyId:mutation.agentSnapshot.partyId,...(mutation.agentSnapshot.agreement?{commissionAgreement:mutation.agentSnapshot.agreement}:{})}:old.commissionAgreement?{commissionAgreement:old.commissionAgreement}:{}),financialMutation:{...mutation,state:'COMPLETED',evidence},updatedAt:this.now().toISOString()};
    try{return await this.repo.save(next,this.history(c,id,changed?'AGENT_CHANGED':'AGENT_CHANGE_REJECTED',old.status,old.status,normalized.reason,{commandKey:normalized.commandKey,payloadHash,requestedBy:mutation.actorId,previousAgentId:old.agentId??null,newAgentId:mutation.agentSnapshot.id,evidence}));}
    catch(error){const current=await this.required(c,id),history=await this.repo.history(c.companyId,c.branchId,id);if(history.some(x=>['AGENT_CHANGED','AGENT_CHANGE_REJECTED'].includes(x.action)&&(x.evidence as {commandKey?:string}|undefined)?.commandKey===normalized.commandKey))return current;throw error;}
  }

  async cancel(c:ExecutionContext,id:string,input:CancelOperationalBookingInput):Promise<Booking>{
    await this.permission(c,BOOKING_PERMISSIONS.cancel);
    let old=await this.required(c,id);
    if(old.status==='CANCELLED')return old;
    const reason=required(input.reason,'reason');
    if(old.status==='PRELIMINARY'){
      if(old.financialMutation?.state==='PENDING')throw new ContractValidationError('booking','resume the pending financial operation first');
      if(old.confirmationCommandKey)throw new ContractValidationError('booking','confirmation has started; resume it before cancellation');
      if(old.capacityHold&&old.capacityHold.state!=='RELEASED'){await this.releaseHold(c,id,reason);return this.cancel(c,id,input);}
      const next:Booking={...old,status:'CANCELLED',financialState:'CANCELLED',cancellationEvidence:{financialWorkflow:'NOT_CREATED'},updatedAt:this.now().toISOString()};
      return this.repo.save(next,this.history(c,id,'CANCELLED','PRELIMINARY','CANCELLED',reason,next.cancellationEvidence));
    }
    const commandKey=required(input.commandKey,'commandKey'),postingDate=required(input.postingDate,'postingDate'),payloadHash=createHash('sha256').update(JSON.stringify(ordered({commandKey,postingDate,reason}))).digest('hex');
    if(old.financialMutation?.state==='PENDING'&&(old.financialMutation.kind!=='CANCELLATION'||old.financialMutation.commandKey!==commandKey||old.financialMutation.payloadHash!==payloadHash))throw new ContractValidationError('booking','resume the pending financial operation first');
    if(old.financialMutation?.kind==='CANCELLATION'&&old.financialMutation.commandKey===commandKey&&old.financialMutation.payloadHash!==payloadHash)throw new ContractValidationError('commandKey','conflicting cancellation replay');
    if(old.financialMutation?.state!=='PENDING'){
      const mutation={kind:'CANCELLATION' as const,input:{commandKey,postingDate,reason},commandKey,payloadHash,actorId:c.actorId,state:'PENDING' as const};
      try{old=await this.repo.save({...old,financialMutation:mutation,updatedAt:this.now().toISOString()},this.history(c,id,'CANCELLATION_REQUESTED',old.status,old.status,reason,{commandKey,payloadHash}));}
      catch(error){const current=await this.required(c,id);if(current.status==='CANCELLED')return current;if(current.financialMutation?.kind!=='CANCELLATION'||current.financialMutation.commandKey!==commandKey||current.financialMutation.payloadHash!==payloadHash)throw error;old=current;}
    }
    const mutation=old.financialMutation;if(mutation?.kind!=='CANCELLATION')throw new ContractValidationError('booking','cancellation reservation missing');
    const evidence=await this.finance.cancel({companyId:c.companyId,branchId:c.branchId,commandKey:required(input.commandKey,'commandKey'),bookingId:id,travelStarted:old.status==='TRAVELING'||old.status==='COMPLETED',travelEvidence:`BOOKING_STATUS:${old.status}`,postingDate:required(input.postingDate,'postingDate')});
    const cancelled=Boolean((evidence as {cancelled?:boolean}|null)?.cancelled);
    if(!cancelled){
      const next:Booking={...old,financialMutation:{...mutation,state:'COMPLETED',evidence},financialState:'CANCELLATION_BLOCKED',cancellationEvidence:evidence,updatedAt:this.now().toISOString()};
      return this.repo.save(next,this.history(c,id,'CANCELLATION_BLOCKED',old.status,old.status,reason,evidence));
    }
    const next:Booking={...old,financialMutation:{...mutation,state:'COMPLETED',evidence},status:'CANCELLED',financialState:'CANCELLED',cancellationEvidence:evidence,updatedAt:this.now().toISOString()};
    const saved=await this.repo.save(next,this.history(c,id,'CANCELLED',old.status,'CANCELLED',reason,evidence));
    await this.access.audit(c,'hajj-umrah.booking.cancelled',id,{reason});
    return saved;
  }

  async markReady(c:ExecutionContext,id:string){return this.transition(c,id,'CONFIRMED','READY','MARKED_READY');}
  async startTravel(c:ExecutionContext,id:string){return this.transition(c,id,'READY','TRAVELING','TRAVEL_STARTED');}
  async complete(c:ExecutionContext,id:string){return this.transition(c,id,'TRAVELING','COMPLETED','COMPLETED');}

  private async transition(c:ExecutionContext,id:string,from:BookingStatus,to:BookingStatus,action:string){
    await this.permission(c,BOOKING_PERMISSIONS.lifecycle);const old=await this.required(c,id);
    if(old.status!==from)throw new ContractValidationError('status',`expected ${from}`);
    if(old.financialMutation?.state==='PENDING')throw new ContractValidationError('booking','resume the pending financial operation first');
    const next={...old,status:to,updatedAt:this.now().toISOString()};
    const saved=await this.repo.save(next,this.history(c,id,action,from,to));
    await this.access.audit(c,`hajj-umrah.booking.${action.toLowerCase()}`,id,{});
    return saved;
  }

  private confirmationHash(input:ConfirmOperationalBookingInput){
    const normalized={...input,inventories:[...input.inventories].sort((a,b)=>a.allocationId.localeCompare(b.allocationId))};
    return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  }
  private extractAllocationIds(evidence:unknown):string[]{
    const rows=(evidence as {allocations?:readonly {id?:string}[]}|null)?.allocations??[];
    return rows.map(v=>v.id).filter((v):v is string=>Boolean(v));
  }
}
