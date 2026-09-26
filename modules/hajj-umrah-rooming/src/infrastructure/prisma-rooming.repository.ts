import { Prisma, type HurRoomAssignment, type HurRoomingHistory, type PrismaClient } from '@prisma/client';
import { ContractValidationError, companyId } from '@elhafez/contracts';
import type { RoomAssignment, RoomingHistory } from '../domain/rooming.js';
import type { RoomingRepository } from '../application/rooming.repository.js';

const json=(value:unknown)=>value as Prisma.InputJsonValue;
const map=(row:HurRoomAssignment):RoomAssignment=>({
  id:row.id,companyId:companyId(row.companyId),branchId:row.branchId,programId:row.programId,bookingId:row.bookingId,
  travelerId:row.travelerId,allocationId:row.allocationId,roomKey:row.roomKey,...(row.roomLabel?{roomLabel:row.roomLabel}:{}),
  startDate:row.startDate.toISOString().slice(0,10),endDate:row.endDate.toISOString().slice(0,10),status:row.status as RoomAssignment['status'],
  revision:row.revision,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString(),
});
const historyMap=(row:HurRoomingHistory):RoomingHistory=>({
  id:row.id,companyId:companyId(row.companyId),branchId:row.branchId,assignmentId:row.assignmentId,action:row.action as RoomingHistory['action'],
  snapshot:row.snapshot as unknown as RoomAssignment,actorId:row.actorId,occurredAt:row.occurredAt.toISOString(),
});

export class PrismaRoomingRepository implements RoomingRepository {
  constructor(private readonly db:PrismaClient){}

  private data(value:RoomAssignment){
    return{id:value.id,companyId:value.companyId,branchId:value.branchId,programId:value.programId,bookingId:value.bookingId,
      travelerId:value.travelerId,allocationId:value.allocationId,roomKey:value.roomKey,roomLabel:value.roomLabel??null,
      startDate:new Date(value.startDate),endDate:new Date(value.endDate),status:value.status,revision:value.revision,
      createdAt:new Date(value.createdAt),updatedAt:new Date(value.updatedAt)};
  }
  private historyData(value:RoomingHistory){
    return{id:value.id,companyId:value.companyId,branchId:value.branchId,assignmentId:value.assignmentId,action:value.action,
      snapshot:json(value.snapshot),actorId:value.actorId,occurredAt:new Date(value.occurredAt)};
  }
  private async serializable<T>(work:(tx:Prisma.TransactionClient)=>Promise<T>):Promise<T>{
    try{return await this.db.$transaction(work,{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});}
    catch(error){
      if((error as {code?:string}).code==='P2034')throw new ContractValidationError('revision','room assignment changed; reload and retry');
      throw error;
    }
  }
  private async locks(tx:Prisma.TransactionClient,keys:readonly string[]){
    for(const key of [...new Set(keys)].sort()){
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`);
    }
  }
  private lockKeys(value:RoomAssignment){
    const scope=`${value.companyId}:${value.branchId}`;
    return[
      `hur:assignment:${scope}:${value.id}`,
      `hur:traveler:${scope}:${value.travelerId}`,
      `hur:allocation:${scope}:${value.allocationId}`,
    ];
  }
  private stale(expected:number,actual:number){
    if(actual!==expected)throw new ContractValidationError('revision','room assignment changed; reload and retry');
  }
  private async assertIntegrity(tx:Prisma.TransactionClient,value:RoomAssignment,capacity:number,excludeId?:string){
    const overlap=await tx.hurRoomAssignment.findFirst({where:{
      companyId:value.companyId,branchId:value.branchId,travelerId:value.travelerId,status:'ASSIGNED',
      ...(excludeId?{id:{not:excludeId}}:{}),startDate:{lte:new Date(value.endDate)},endDate:{gte:new Date(value.startDate)},
    }});
    if(overlap)throw new ContractValidationError('travelerId','traveler already has an overlapping room assignment');
    const count=await tx.hurRoomAssignment.count({where:{
      companyId:value.companyId,branchId:value.branchId,allocationId:value.allocationId,status:'ASSIGNED',
      ...(excludeId?{id:{not:excludeId}}:{}),startDate:{lte:new Date(value.endDate)},endDate:{gte:new Date(value.startDate)},
    }});
    if(count>=capacity)throw new ContractValidationError('capacity','hotel allocation capacity exceeded');
  }

  async createGuarded(value:RoomAssignment,history:RoomingHistory,capacity:number){
    return this.serializable(async tx=>{
      await this.locks(tx,this.lockKeys(value));
      await this.assertIntegrity(tx,value,capacity);
      const created=await tx.hurRoomAssignment.create({data:this.data(value)});
      await tx.hurRoomingHistory.create({data:this.historyData(history)});
      return map(created);
    });
  }

  async saveGuarded(value:RoomAssignment,history:RoomingHistory,capacity:number,expectedRevision:number){
    return this.serializable(async tx=>{
      await this.locks(tx,this.lockKeys(value));
      const current=await tx.hurRoomAssignment.findUnique({where:{id_companyId_branchId:{id:value.id,companyId:value.companyId,branchId:value.branchId}}});
      if(!current)throw new ContractValidationError('assignmentId','room assignment not found');
      this.stale(expectedRevision,current.revision);
      if(current.status!=='ASSIGNED')throw new ContractValidationError('status','only active assignment can be moved');
      await this.assertIntegrity(tx,value,capacity,value.id);
      const result=await tx.hurRoomAssignment.updateMany({
        where:{id:value.id,companyId:value.companyId,branchId:value.branchId,revision:expectedRevision,status:'ASSIGNED'},
        data:this.data(value),
      });
      if(result.count!==1)throw new ContractValidationError('revision','room assignment changed; reload and retry');
      await tx.hurRoomingHistory.create({data:this.historyData(history)});
      return value;
    });
  }

  async save(value:RoomAssignment,history:RoomingHistory,expectedRevision:number){
    return this.serializable(async tx=>{
      await this.locks(tx,this.lockKeys(value));
      const current=await tx.hurRoomAssignment.findUnique({where:{id_companyId_branchId:{id:value.id,companyId:value.companyId,branchId:value.branchId}}});
      if(!current)throw new ContractValidationError('assignmentId','room assignment not found');
      this.stale(expectedRevision,current.revision);
      const result=await tx.hurRoomAssignment.updateMany({
        where:{id:value.id,companyId:value.companyId,branchId:value.branchId,revision:expectedRevision},
        data:this.data(value),
      });
      if(result.count!==1)throw new ContractValidationError('revision','room assignment changed; reload and retry');
      await tx.hurRoomingHistory.create({data:this.historyData(history)});
      return value;
    });
  }

  async swap(
    a:RoomAssignment,historyA:RoomingHistory,capacityA:number,expectedRevisionA:number,
    b:RoomAssignment,historyB:RoomingHistory,capacityB:number,expectedRevisionB:number,
  ){
    await this.serializable(async tx=>{
      await this.locks(tx,[...this.lockKeys(a),...this.lockKeys(b)]);
      const [currentA,currentB]=await Promise.all([
        tx.hurRoomAssignment.findUnique({where:{id_companyId_branchId:{id:a.id,companyId:a.companyId,branchId:a.branchId}}}),
        tx.hurRoomAssignment.findUnique({where:{id_companyId_branchId:{id:b.id,companyId:b.companyId,branchId:b.branchId}}}),
      ]);
      if(!currentA||!currentB)throw new ContractValidationError('assignmentId','room assignment not found');
      this.stale(expectedRevisionA,currentA.revision);
      this.stale(expectedRevisionB,currentB.revision);
      if(currentA.status!=='ASSIGNED'||currentB.status!=='ASSIGNED')throw new ContractValidationError('status','both assignments must remain active during swap');

      const excluded=[a.id,b.id];
      const leftOverlap=await tx.hurRoomAssignment.findFirst({where:{companyId:a.companyId,branchId:a.branchId,travelerId:a.travelerId,status:'ASSIGNED',id:{notIn:excluded},startDate:{lte:new Date(a.endDate)},endDate:{gte:new Date(a.startDate)}}});
      if(leftOverlap)throw new ContractValidationError('travelerId','traveler already has an overlapping room assignment');
      const rightOverlap=await tx.hurRoomAssignment.findFirst({where:{companyId:b.companyId,branchId:b.branchId,travelerId:b.travelerId,status:'ASSIGNED',id:{notIn:excluded},startDate:{lte:new Date(b.endDate)},endDate:{gte:new Date(b.startDate)}}});
      if(rightOverlap)throw new ContractValidationError('travelerId','traveler already has an overlapping room assignment');
      const leftCount=await tx.hurRoomAssignment.count({where:{companyId:a.companyId,branchId:a.branchId,allocationId:a.allocationId,status:'ASSIGNED',id:{notIn:excluded},startDate:{lte:new Date(a.endDate)},endDate:{gte:new Date(a.startDate)}}});
      const rightCount=await tx.hurRoomAssignment.count({where:{companyId:b.companyId,branchId:b.branchId,allocationId:b.allocationId,status:'ASSIGNED',id:{notIn:excluded},startDate:{lte:new Date(b.endDate)},endDate:{gte:new Date(b.startDate)}}});
      if(a.allocationId===b.allocationId){
        const overlap=a.startDate<=b.endDate&&b.startDate<=a.endDate;
        const extra=overlap?2:1;
        if(leftCount+extra>capacityA||rightCount+extra>capacityB)throw new ContractValidationError('capacity','hotel allocation capacity exceeded');
      }else if(leftCount+1>capacityA||rightCount+1>capacityB){
        throw new ContractValidationError('capacity','hotel allocation capacity exceeded');
      }

      const leftWrite=await tx.hurRoomAssignment.updateMany({
        where:{id:a.id,companyId:a.companyId,branchId:a.branchId,revision:expectedRevisionA,status:'ASSIGNED'},
        data:this.data(a),
      });
      if(leftWrite.count!==1)throw new ContractValidationError('revision','room assignment changed; reload and retry');
      const rightWrite=await tx.hurRoomAssignment.updateMany({
        where:{id:b.id,companyId:b.companyId,branchId:b.branchId,revision:expectedRevisionB,status:'ASSIGNED'},
        data:this.data(b),
      });
      if(rightWrite.count!==1)throw new ContractValidationError('revision','room assignment changed; reload and retry');

      await tx.hurRoomingHistory.create({data:this.historyData(historyA)});
      await tx.hurRoomingHistory.create({data:this.historyData(historyB)});
    });
  }

  async get(companyId:string,branchId:string,id:string){
    const row=await this.db.hurRoomAssignment.findUnique({where:{id_companyId_branchId:{id,companyId,branchId}}});
    return row?map(row):null;
  }
  async list(companyId:string,branchId:string,programId?:string){
    return(await this.db.hurRoomAssignment.findMany({where:{companyId,branchId,...(programId?{programId}:{})},orderBy:{createdAt:'desc'}})).map(map);
  }
  async history(companyId:string,branchId:string,assignmentId:string){
    return(await this.db.hurRoomingHistory.findMany({where:{companyId,branchId,assignmentId},orderBy:{occurredAt:'asc'}})).map(historyMap);
  }
}
