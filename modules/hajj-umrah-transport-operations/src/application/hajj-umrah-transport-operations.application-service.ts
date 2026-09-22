import { randomUUID } from 'node:crypto';
import { ContractValidationError, type ExecutionContext } from '@elhafez/contracts';
import type { ManifestAssignment, TransportHistory, TransportRun } from '../domain/transport.js';
import type { TransportRepository } from './transport.repository.js';
import type { TransportAccess, TransportBookingPort, TransportInventoryPort, TransportTravelerPort } from './transport.ports.js';

export const TRANSPORT_PERMISSIONS=Object.freeze({view:'hajj_umrah.transport.view',manage:'hajj_umrah.transport.manage',dispatch:'hajj_umrah.transport.dispatch'});
export interface CreateTransportRunInput{programId:string;allocationId:string;code:string;route:string;startsAt:string;endsAt:string;vehicleReference?:string;driverReference?:string;}
const required=(value:string,field:string)=>{const result=value.trim();if(!result)throw new ContractValidationError(field,'is required');return result;};
const iso=(value:string,field:string)=>{const result=required(value,field),date=new Date(result);if(Number.isNaN(date.valueOf()))throw new ContractValidationError(field,'must be an ISO datetime');return date.toISOString();};

export class HajjUmrahTransportOperationsApplicationService{
  constructor(
    private readonly repo:TransportRepository,
    private readonly access:TransportAccess,
    private readonly bookings:TransportBookingPort,
    private readonly travelers:TransportTravelerPort,
    private readonly inventory:TransportInventoryPort,
    private readonly now:()=>Date=()=>new Date(),
    private readonly id:()=>string=()=>randomUUID(),
  ){}
  private async permission(context:ExecutionContext,permission:string){await this.access.requireBranch(context);await this.access.requirePermission(context,permission);}
  private history(context:ExecutionContext,type:'RUN'|'MANIFEST',id:string,action:string,evidence?:unknown):TransportHistory{return{id:this.id(),companyId:context.companyId,branchId:context.branchId,aggregateType:type,aggregateId:id,action,...(evidence===undefined?{}:{evidence}),actorId:context.actorId,occurredAt:this.now().toISOString()};}
  private async run(context:ExecutionContext,id:string){const value=await this.repo.getRun(context.companyId,context.branchId,id);if(!value)throw new ContractValidationError('runId','transport run not found');return value;}
  private async allocation(context:ExecutionContext,id:string,programId:string,start:string,end:string){
    const value=await this.inventory.allocation(context.companyId,required(id,'allocationId'));
    if(!value||value.resourceType!=='TRANSPORT'||value.program.sourceId!==programId||!['CONFIRMED','PARTIALLY_RELEASED','CONSUMED'].includes(value.status))throw new ContractValidationError('allocationId','canonical TRANSPORT allocation evidence is required');
    const from=value.serviceDate.slice(0,10),to=(value.periodEnd??value.serviceDate).slice(0,10);
    if(start.slice(0,10)<from||end.slice(0,10)>to)throw new ContractValidationError('schedule','run is outside transport allocation window');
    const capacity=Math.floor(Number(value.quantity));
    if(!Number.isFinite(capacity)||capacity<1)throw new ContractValidationError('allocationId','transport allocation has no usable capacity');
    return{value,capacity};
  }

  async createRun(context:ExecutionContext,input:CreateTransportRunInput){
    await this.permission(context,TRANSPORT_PERMISSIONS.manage);
    const start=iso(input.startsAt,'startsAt'),end=iso(input.endsAt,'endsAt');
    if(end<=start)throw new ContractValidationError('endsAt','must be after startsAt');
    await this.allocation(context,input.allocationId,required(input.programId,'programId'),start,end);
    const at=this.now().toISOString();
    const value:TransportRun={id:this.id(),companyId:context.companyId,branchId:context.branchId,programId:input.programId,allocationId:input.allocationId,code:required(input.code,'code'),route:required(input.route,'route'),startsAt:start,endsAt:end,...(input.vehicleReference?.trim()?{vehicleReference:input.vehicleReference.trim()}:{}),...(input.driverReference?.trim()?{driverReference:input.driverReference.trim()}:{}),status:'SCHEDULED',revision:1,createdAt:at,updatedAt:at};
    return this.repo.createRun(value,this.history(context,'RUN',value.id,'CREATED'));
  }

  async assignTraveler(context:ExecutionContext,runId:string,bookingId:string,travelerId:string){
    await this.permission(context,TRANSPORT_PERMISSIONS.manage);
    const run=await this.run(context,runId);
    if(run.status!=='SCHEDULED')throw new ContractValidationError('status','manifest can only change before dispatch');
    const booking=await this.bookings.requireTraveler(context,bookingId,travelerId);
    if(booking.programId!==run.programId)throw new ContractValidationError('bookingId','booking belongs to a different program');
    await this.travelers.requireActive(context,travelerId);
    const allocation=await this.allocation(context,run.allocationId,run.programId,run.startsAt,run.endsAt);
    const at=this.now().toISOString();
    const value:ManifestAssignment={id:this.id(),companyId:context.companyId,branchId:context.branchId,runId:run.id,bookingId,travelerId,status:'ASSIGNED',revision:1,createdAt:at,updatedAt:at};
    return this.repo.assignGuarded(value,this.history(context,'MANIFEST',value.id,'ASSIGNED',{runId:run.id,travelerId}),run,allocation.capacity);
  }

  async removeTraveler(context:ExecutionContext,assignmentId:string,runId:string){
    await this.permission(context,TRANSPORT_PERMISSIONS.manage);
    const run=await this.run(context,runId);
    if(run.status!=='SCHEDULED')throw new ContractValidationError('status','manifest can only change before dispatch');
    const row=(await this.repo.manifest(context.companyId,context.branchId,runId)).find(value=>value.id===assignmentId);
    if(!row)throw new ContractValidationError('assignmentId','manifest assignment not found');
    if(row.status==='REMOVED')return row;
    const next={...row,status:'REMOVED' as const,revision:row.revision+1,updatedAt:this.now().toISOString()};
    return this.repo.saveAssignment(next,this.history(context,'MANIFEST',row.id,'REMOVED',{runId}),row.revision,run);
  }

  async dispatch(context:ExecutionContext,id:string){
    await this.permission(context,TRANSPORT_PERMISSIONS.dispatch);
    const old=await this.run(context,id);
    if(old.status==='DISPATCHED')return old;
    if(old.status!=='SCHEDULED')throw new ContractValidationError('status','only scheduled run can dispatch');
    await this.allocation(context,old.allocationId,old.programId,old.startsAt,old.endsAt);
    const next={...old,status:'DISPATCHED' as const,revision:old.revision+1,updatedAt:this.now().toISOString()};
    const saved=await this.repo.saveRun(next,this.history(context,'RUN',id,'DISPATCHED'),old.revision,old.status);
    await this.access.audit(context,'hajj-umrah.transport.dispatched',id,{manifestCount:await this.repo.activeManifestCount(context.companyId,context.branchId,id)});
    return saved;
  }
  async complete(context:ExecutionContext,id:string){await this.permission(context,TRANSPORT_PERMISSIONS.dispatch);const old=await this.run(context,id);if(old.status==='COMPLETED')return old;if(old.status!=='DISPATCHED')throw new ContractValidationError('status','only dispatched run can complete');const next={...old,status:'COMPLETED' as const,revision:old.revision+1,updatedAt:this.now().toISOString()};return this.repo.saveRun(next,this.history(context,'RUN',id,'COMPLETED'),old.revision,old.status);}
  async cancel(context:ExecutionContext,id:string,reason:string){await this.permission(context,TRANSPORT_PERMISSIONS.manage);const old=await this.run(context,id);if(old.status==='CANCELLED')return old;if(old.status!=='SCHEDULED')throw new ContractValidationError('status','dispatched run cannot be cancelled');const next={...old,status:'CANCELLED' as const,revision:old.revision+1,updatedAt:this.now().toISOString()};return this.repo.saveRun(next,this.history(context,'RUN',id,'CANCELLED',{reason:required(reason,'reason')}),old.revision,old.status);}
  async listRunsForIntegration(context:ExecutionContext,programId:string){await this.access.requireBranch(context);return this.repo.listRuns(context.companyId,context.branchId,programId);}
  async manifestForIntegration(context:ExecutionContext,id:string){await this.access.requireBranch(context);const value=await this.run(context,id);return this.repo.manifest(context.companyId,context.branchId,value.id);}
  async listRuns(context:ExecutionContext,programId?:string){await this.permission(context,TRANSPORT_PERMISSIONS.view);return this.repo.listRuns(context.companyId,context.branchId,programId);}
  async manifest(context:ExecutionContext,id:string){await this.permission(context,TRANSPORT_PERMISSIONS.view);await this.run(context,id);return this.repo.manifest(context.companyId,context.branchId,id);}
  async historyFor(context:ExecutionContext,type:'RUN'|'MANIFEST',id:string){await this.permission(context,TRANSPORT_PERMISSIONS.view);return this.repo.history(context.companyId,context.branchId,type,id);}
}
