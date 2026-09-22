import { Prisma, type PrismaClient } from '@prisma/client';
import { ContractValidationError } from '@elhafez/contracts';
import type { RoomAssignment, RoomingHistory } from '../domain/rooming.js';
import type { RoomingRepository } from '../application/rooming.repository.js';

const json=(value:unknown)=>value as Prisma.InputJsonValue;
const map=(row:any):RoomAssignment=>({
  id:row.id,companyId:row.companyId,branchId:row.branchId,programId:row.programId,bookingId:row.bookingId,
  travelerId:row.travelerId,allocationId:row.allocationId,roomKey:row.roomKey,...(row.roomLabel?{roomLabel:row.roomLabel}:{}),
  startDate:row.startDate.toISOString().slice(0,10),endDate:row.endDate.toISOString().slice(0,10),status:row.status,
  createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString(),
});
const historyMap=(row:any):RoomingHistory=>({
  id:row.id,companyId:row.companyId,branchId:row.branchId,assignmentId:row.assignmentId,action:row.action,
  snapshot:row.snapshot as unknown as RoomAssignment,actorId:row.actorId,occurredAt:row.occurredAt.toISOString(),
});

export class PrismaRoomingRepository implements RoomingRepository {
  constructor(private readonly db:PrismaClient){}

  private data(value:RoomAssignment){
    return{id:value.id,companyId:value.companyId,branchId:value.branchId,programId:value.programId,bookingId:value.bookingId,
      travelerId:value.travelerId,allocationId:value.allocationId,roomKey:value.roomKey,roomLabel:value.roomLabel??null,
      startDate:new Date(value.startDate),endDate:new Date(value.endDate),status:value.status,
      createdAt:new Date(value.createdAt),updatedAt:new Date(value.updatedAt)};
  }
  private historyData(value:RoomingHistory){
    return{id:value.id,companyId:value.companyId,branchId:value.branchId,assignmentId:value.assignmentId,action:value.action,
      snapshot:json(value.snapshot),actorId:value.actorId,occurredAt:new Date(value.occurredAt)};
  }
  private async locks(tx:Prisma.TransactionClient,keys:readonly string[]){
    for(const key of [...new Set(keys)].sort()){
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
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
    return this.db.$transaction(async tx=>{
      await this.locks(tx,this.lockKeys(value));
      await this.assertIntegrity(tx,value,capacity);
      await tx.hurRoomAssignment.create({data:this.data(value)});
      await tx.hurRoomingHistory.create({data:this.historyData(history)});
      return value;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  async saveGuarded(value:RoomAssignment,history:RoomingHistory,capacity:number){
    return this.db.$transaction(async tx=>{
      await this.locks(tx,this.lockKeys(value));
      const current=await tx.hurRoomAssignment.findUnique({where:{id_companyId_branchId:{id:value.id,companyId:value.companyId,branchId:value.branchId}}});
      if(!current||current.status!=='ASSIGNED')throw new ContractValidationError('status','only active assignment can be moved');
      await this.assertIntegrity(tx,value,capacity,value.id);
      await tx.hurRoomAssignment.update({where:{id_companyId_branchId:{id:value.id,companyId:value.companyId,branchId:value.branchId}},data:this.data(value)});
      await tx.hurRoomingHistory.create({data:this.historyData(history)});
      return value;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  async save(value:RoomAssignment,history:RoomingHistory){
    return this.db.$transaction(async tx=>{
      await this.locks(tx,this.lockKeys(value));
      await tx.hurRoomAssignment.update({where:{id_companyId_branchId:{id:value.id,companyId:value.companyId,branchId:value.branchId}},data:this.data(value)});
      await tx.hurRoomingHistory.create({data:this.historyData(history)});
      return value;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  async swap(a:RoomAssignment,historyA:RoomingHistory,b:RoomAssignment,historyB:RoomingHistory){
    await this.db.$transaction(async tx=>{
      await this.locks(tx,[...this.lockKeys(a),...this.lockKeys(b)]);
      const [currentA,currentB]=await Promise.all([
        tx.hurRoomAssignment.findUnique({where:{id_companyId_branchId:{id:a.id,companyId:a.companyId,branchId:a.branchId}}}),
        tx.hurRoomAssignment.findUnique({where:{id_companyId_branchId:{id:b.id,companyId:b.companyId,branchId:b.branchId}}}),
      ]);
      if(!currentA||!currentB||currentA.status!=='ASSIGNED'||currentB.status!=='ASSIGNED')throw new ContractValidationError('status','both assignments must remain active during swap');
      await tx.hurRoomAssignment.update({where:{id_companyId_branchId:{id:a.id,companyId:a.companyId,branchId:a.branchId}},data:this.data(a)});
      await tx.hurRoomingHistory.create({data:this.historyData(historyA)});
      await tx.hurRoomAssignment.update({where:{id_companyId_branchId:{id:b.id,companyId:b.companyId,branchId:b.branchId}},data:this.data(b)});
      await tx.hurRoomingHistory.create({data:this.historyData(historyB)});
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
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
