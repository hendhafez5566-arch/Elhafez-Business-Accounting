import { randomUUID } from 'node:crypto';
import { ContractValidationError, type ExecutionContext } from '@elhafez/contracts';
import type { Allocation } from '@elhafez/tourism-contract-inventory';
import type { RoomAssignment, RoomingHistory } from '../domain/rooming.js';
import type { RoomingRepository } from './rooming.repository.js';
import type { RoomingAccess, RoomingBookingPort, RoomingInventoryPort, RoomingProgramPort, RoomingTravelerPort } from './rooming.ports.js';

export const ROOMING_PERMISSIONS=Object.freeze({view:'hajj_umrah.rooming.view',manage:'hajj_umrah.rooming.manage'});
export interface AssignRoomInput{bookingId:string;travelerId:string;allocationId:string;roomKey:string;roomLabel?:string;startDate:string;endDate:string;}
export type ReassignRoomInput=Omit<AssignRoomInput,'bookingId'|'travelerId'>;

const required=(value:string,field:string)=>{const result=value.trim();if(!result)throw new ContractValidationError(field,'is required');return result;};
const day=(value:string,field:string)=>{const result=required(value,field);if(!/^\d{4}-\d{2}-\d{2}$/.test(result))throw new ContractValidationError(field,'must be YYYY-MM-DD');return result;};

export class HajjUmrahRoomingApplicationService{
  constructor(
    private readonly repo:RoomingRepository,
    private readonly access:RoomingAccess,
    private readonly bookings:RoomingBookingPort,
    private readonly programs:RoomingProgramPort,
    private readonly travelers:RoomingTravelerPort,
    private readonly inventory:RoomingInventoryPort,
    private readonly now:()=>Date=()=>new Date(),
    private readonly id:()=>string=()=>randomUUID(),
  ){}

  private async permission(context:ExecutionContext,permission:string){await this.access.requireBranch(context);await this.access.requirePermission(context,permission);}
  private async requiredAssignment(context:ExecutionContext,id:string){const value=await this.repo.get(context.companyId,context.branchId,id);if(!value)throw new ContractValidationError('assignmentId','room assignment not found');return value;}
  private history(context:ExecutionContext,value:RoomAssignment,action:RoomingHistory['action']):RoomingHistory{return{id:this.id(),companyId:context.companyId,branchId:context.branchId,assignmentId:value.id,action,snapshot:value,actorId:context.actorId,occurredAt:this.now().toISOString()};}

  private hotelCapacity(allocation:Allocation){
    const capacity=Math.floor(Number(allocation.quantity));
    if(!Number.isFinite(capacity)||capacity<1)throw new ContractValidationError('allocationId','hotel allocation has no usable capacity');
    return capacity;
  }
  private assertHotelEvidence(allocation:Allocation|null,programId:string,start:string,end:string){
    if(!allocation||allocation.resourceType!=='HOTEL'||allocation.program.sourceId!==programId||!['CONFIRMED','PARTIALLY_RELEASED','CONSUMED'].includes(allocation.status)){
      throw new ContractValidationError('allocationId','active HOTEL allocation evidence is required');
    }
    const allocationStart=allocation.serviceDate.slice(0,10);
    const allocationEnd=(allocation.periodEnd??allocation.serviceDate).slice(0,10);
    if(start<allocationStart||end>allocationEnd)throw new ContractValidationError('stay','stay is outside hotel allocation evidence window');
    return allocation;
  }

  private async validateEvidence(context:ExecutionContext,bookingId:string,travelerId:string,input:{allocationId:string;startDate:string;endDate:string}){
    const start=day(input.startDate,'startDate'),end=day(input.endDate,'endDate');
    if(end<start)throw new ContractValidationError('endDate','must be on or after startDate');
    const booking=await this.bookings.requireTraveler(context,bookingId,travelerId);
    await this.travelers.requireActive(context,travelerId);
    const program=await this.programs.require(context,booking.programId);
    if(start<program.snapshot.departureDate.slice(0,10)||end>program.snapshot.returnDate.slice(0,10))throw new ContractValidationError('stay','stay is outside program window');
    const allocation=this.assertHotelEvidence(await this.inventory.allocation(context.companyId,required(input.allocationId,'allocationId')),program.id,start,end);
    return{booking,program,allocation,start,end,capacity:this.hotelCapacity(allocation)};
  }

  async assign(context:ExecutionContext,input:AssignRoomInput){
    await this.permission(context,ROOMING_PERMISSIONS.manage);
    const evidence=await this.validateEvidence(context,input.bookingId,input.travelerId,input);
    const at=this.now().toISOString();
    const value:RoomAssignment={id:this.id(),companyId:context.companyId,branchId:context.branchId,programId:evidence.program.id,bookingId:input.bookingId,travelerId:input.travelerId,allocationId:evidence.allocation.id,roomKey:required(input.roomKey,'roomKey'),...(input.roomLabel?.trim()?{roomLabel:input.roomLabel.trim()}:{}),startDate:evidence.start,endDate:evidence.end,status:'ASSIGNED',createdAt:at,updatedAt:at};
    const saved=await this.repo.createGuarded(value,this.history(context,value,'ASSIGNED'),evidence.capacity);
    await this.access.audit(context,'hajj-umrah.rooming.assigned',value.id,{travelerId:value.travelerId});
    return saved;
  }

  async reassign(context:ExecutionContext,id:string,input:ReassignRoomInput){
    await this.permission(context,ROOMING_PERMISSIONS.manage);
    const old=await this.requiredAssignment(context,id);
    if(old.status!=='ASSIGNED')throw new ContractValidationError('status','only active assignment can be moved');
    const evidence=await this.validateEvidence(context,old.bookingId,old.travelerId,input);
    const next:RoomAssignment={...old,programId:evidence.program.id,allocationId:evidence.allocation.id,roomKey:required(input.roomKey,'roomKey'),...(input.roomLabel?.trim()?{roomLabel:input.roomLabel.trim()}:{roomLabel:undefined}),startDate:evidence.start,endDate:evidence.end,updatedAt:this.now().toISOString()};
    const saved=await this.repo.saveGuarded(next,this.history(context,next,'REASSIGNED'),evidence.capacity);
    await this.access.audit(context,'hajj-umrah.rooming.reassigned',id,{});
    return saved;
  }

  async swap(context:ExecutionContext,leftId:string,rightId:string){
    await this.permission(context,ROOMING_PERMISSIONS.manage);
    if(leftId===rightId)throw new ContractValidationError('assignmentId','two different assignments are required');
    const left=await this.requiredAssignment(context,leftId),right=await this.requiredAssignment(context,rightId);
    if(left.status!=='ASSIGNED'||right.status!=='ASSIGNED')throw new ContractValidationError('status','both assignments must be active');
    if(left.programId!==right.programId)throw new ContractValidationError('programId','swap requires the same program');

    const [targetForLeft,targetForRight]=await Promise.all([
      this.inventory.allocation(context.companyId,right.allocationId),
      this.inventory.allocation(context.companyId,left.allocationId),
    ]);
    this.assertHotelEvidence(targetForLeft,left.programId,left.startDate,left.endDate);
    this.assertHotelEvidence(targetForRight,right.programId,right.startDate,right.endDate);

    const at=this.now().toISOString();
    const nextLeft:RoomAssignment={...left,allocationId:right.allocationId,roomKey:right.roomKey,...(right.roomLabel?{roomLabel:right.roomLabel}:{roomLabel:undefined}),updatedAt:at};
    const nextRight:RoomAssignment={...right,allocationId:left.allocationId,roomKey:left.roomKey,...(left.roomLabel?{roomLabel:left.roomLabel}:{roomLabel:undefined}),updatedAt:at};
    await this.repo.swap(nextLeft,this.history(context,nextLeft,'SWAPPED'),nextRight,this.history(context,nextRight,'SWAPPED'));
    await this.access.audit(context,'hajj-umrah.rooming.swapped',left.id,{otherAssignmentId:right.id});
    return[nextLeft,nextRight] as const;
  }

  async unassign(context:ExecutionContext,id:string){
    await this.permission(context,ROOMING_PERMISSIONS.manage);
    const old=await this.requiredAssignment(context,id);
    if(old.status==='UNASSIGNED')return old;
    const next={...old,status:'UNASSIGNED' as const,updatedAt:this.now().toISOString()};
    return this.repo.save(next,this.history(context,next,'UNASSIGNED'));
  }
  async list(context:ExecutionContext,programId?:string){await this.permission(context,ROOMING_PERMISSIONS.view);return this.repo.list(context.companyId,context.branchId,programId);}
  async historyFor(context:ExecutionContext,id:string){await this.permission(context,ROOMING_PERMISSIONS.view);await this.requiredAssignment(context,id);return this.repo.history(context.companyId,context.branchId,id);}
}
