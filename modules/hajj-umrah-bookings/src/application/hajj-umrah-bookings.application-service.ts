import { createHash, randomUUID } from 'node:crypto';
import { ContractValidationError, type ExecutionContext, type SourceReference } from '@elhafez/contracts';
import type { Booking, BookingHistory, BookingStatus } from '../domain/booking.js';
import type { BookingRepository } from './booking.repository.js';
import type {
  BookingAccess, BookingAgentPort, BookingCustomerPort, BookingFinanceInventoryRequest,
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
  readonly code: string;
  readonly programId: string;
  readonly customerId: string;
  readonly agentId?: string;
  readonly travelerIds: readonly string[];
  readonly sourceReference?: SourceReference;
}
export interface ConfirmOperationalBookingInput {
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
    for(const id of travelerIds){
      const traveler=await this.travelers.requireActive(c,id);
      if(traveler.customerId&&traveler.customerId!==customer.id)throw new ContractValidationError('travelerIds','traveler belongs to a different customer');
    }
    const agent=input.agentId?await this.agents.requireActive(c,input.agentId):undefined;
    const at=this.now().toISOString(),id=this.id();
    const value:Booking={id,companyId:c.companyId,branchId:c.branchId,code:required(input.code,'code'),programId:program.id,customerId:customer.id,customerPartyId:customer.partyId,...(agent?{agentId:agent.id,agentPartyId:agent.partyId}:{}),travelerIds,status:'PRELIMINARY',financialState:'UNCONFIRMED',allocationIds:[],...(input.sourceReference?{sourceReference:input.sourceReference}:{}),createdAt:at,updatedAt:at};
    const saved=await this.repo.create(value,this.history(c,id,'CREATED',undefined,'PRELIMINARY'));
    await this.customers.register(c,customer.id,id);
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

  async confirm(c:ExecutionContext,id:string,input:ConfirmOperationalBookingInput){
    await this.permission(c,BOOKING_PERMISSIONS.confirm);
    const old=await this.required(c,id);
    const payloadHash=this.confirmationHash(input);
    if(old.status!=='PRELIMINARY'){
      if(old.confirmationCommandKey===input.commandKey&&old.confirmationPayloadHash===payloadHash)return old;
      throw new ContractValidationError('commandKey','conflicting booking confirmation replay');
    }
    const program=await this.programs.require(c,old.programId);
    if(program.status!=='BOOKABLE'||!program.bookingOpen)throw new ContractValidationError('programId','program is not open for booking');
    for(const travelerId of old.travelerIds)await this.travelers.requireActive(c,travelerId);
    const evidence=await this.finance.confirm({
      companyId:c.companyId,branchId:c.branchId,commandKey:required(input.commandKey,'commandKey'),bookingId:old.id,programId:program.id,
      programEvidence:`HUP:${program.id}:${program.currentVersionId}:BOOKABLE:OPEN`,category:input.category,costCenterId:required(input.costCenterId,'costCenterId'),
      customerPartyId:old.customerPartyId,currency:required(input.currency,'currency'),grossAmount:input.grossAmount,discountAmount:input.discountAmount,
      ...(input.approvalRequestId?{approvalRequestId:input.approvalRequestId}:{}),postingDate:required(input.postingDate,'postingDate'),dueDate:required(input.dueDate,'dueDate'),
      invoiceNumber:required(input.invoiceNumber,'invoiceNumber'),inventories:input.inventories,
      ...(old.agentPartyId&&input.commissionAmount?{commission:{agentPartyId:old.agentPartyId,amount:input.commissionAmount}}:{}),
    });
    const allocationIds=this.extractAllocationIds(evidence);
    const next:Booking={...old,status:'CONFIRMED',financialState:'CONFIRMED',allocationIds,confirmationCommandKey:input.commandKey,confirmationPayloadHash:payloadHash,financialEvidence:evidence,updatedAt:this.now().toISOString()};
    const saved=await this.repo.save(next,this.history(c,id,'CONFIRMED','PRELIMINARY','CONFIRMED',undefined,evidence));
    await this.access.audit(c,'hajj-umrah.booking.confirmed',id,{allocationIds});
    return saved;
  }

  async cancel(c:ExecutionContext,id:string,input:CancelOperationalBookingInput){
    await this.permission(c,BOOKING_PERMISSIONS.cancel);
    const old=await this.required(c,id);
    if(old.status==='CANCELLED')return old;
    const reason=required(input.reason,'reason');
    if(old.status==='PRELIMINARY'){
      const next:Booking={...old,status:'CANCELLED',financialState:'CANCELLED',cancellationEvidence:{financialWorkflow:'NOT_CREATED'},updatedAt:this.now().toISOString()};
      return this.repo.save(next,this.history(c,id,'CANCELLED','PRELIMINARY','CANCELLED',reason,next.cancellationEvidence));
    }
    const evidence=await this.finance.cancel({companyId:c.companyId,branchId:c.branchId,commandKey:required(input.commandKey,'commandKey'),bookingId:id,travelStarted:old.status==='TRAVELING'||old.status==='COMPLETED',travelEvidence:`BOOKING_STATUS:${old.status}`,postingDate:required(input.postingDate,'postingDate')});
    const cancelled=Boolean((evidence as {cancelled?:boolean}|null)?.cancelled);
    if(!cancelled){
      const next:Booking={...old,financialState:'CANCELLATION_BLOCKED',cancellationEvidence:evidence,updatedAt:this.now().toISOString()};
      await this.repo.save(next,this.history(c,id,'CANCELLATION_BLOCKED',old.status,old.status,reason,evidence));
      return next;
    }
    const next:Booking={...old,status:'CANCELLED',financialState:'CANCELLED',cancellationEvidence:evidence,updatedAt:this.now().toISOString()};
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
