import { Prisma, type HutrHistory, type HutrManifestAssignment, type HutrRun, type PrismaClient } from '@prisma/client';
import { ContractValidationError, companyId } from '@elhafez/contracts';
import type { ManifestAssignment, TransportHistory, TransportRun } from '../domain/transport.js';
import type { TransportRepository } from '../application/transport.repository.js';

const json=(value:unknown)=>value as Prisma.InputJsonValue;
const runMap=(row:HutrRun):TransportRun=>({id:row.id,companyId:companyId(row.companyId),branchId:row.branchId,programId:row.programId,allocationId:row.allocationId,code:row.code,route:row.route,startsAt:row.startsAt.toISOString(),endsAt:row.endsAt.toISOString(),...(row.vehicleReference?{vehicleReference:row.vehicleReference}:{}),...(row.driverReference?{driverReference:row.driverReference}:{}),status:row.status as TransportRun['status'],createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString()});
const assignmentMap=(row:HutrManifestAssignment):ManifestAssignment=>({id:row.id,companyId:companyId(row.companyId),branchId:row.branchId,runId:row.runId,bookingId:row.bookingId,travelerId:row.travelerId,status:row.status as ManifestAssignment['status'],createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString()});
const historyMap=(row:HutrHistory):TransportHistory=>({id:row.id,companyId:companyId(row.companyId),branchId:row.branchId,aggregateType:row.aggregateType as TransportHistory['aggregateType'],aggregateId:row.aggregateId,action:row.action,...(row.evidence!==null?{evidence:row.evidence}:{}),actorId:row.actorId,occurredAt:row.occurredAt.toISOString()});

export class PrismaTransportRepository implements TransportRepository{
  constructor(private readonly db:PrismaClient){}
  private runData(value:TransportRun){return{id:value.id,companyId:value.companyId,branchId:value.branchId,programId:value.programId,allocationId:value.allocationId,code:value.code,route:value.route,startsAt:new Date(value.startsAt),endsAt:new Date(value.endsAt),vehicleReference:value.vehicleReference??null,driverReference:value.driverReference??null,status:value.status,createdAt:new Date(value.createdAt),updatedAt:new Date(value.updatedAt)}}
  private assignmentData(value:ManifestAssignment){return{id:value.id,companyId:value.companyId,branchId:value.branchId,runId:value.runId,bookingId:value.bookingId,travelerId:value.travelerId,status:value.status,createdAt:new Date(value.createdAt),updatedAt:new Date(value.updatedAt)}}
  private historyData(value:TransportHistory){return{id:value.id,companyId:value.companyId,branchId:value.branchId,aggregateType:value.aggregateType,aggregateId:value.aggregateId,action:value.action,evidence:value.evidence===undefined?Prisma.JsonNull:json(value.evidence),actorId:value.actorId,occurredAt:new Date(value.occurredAt)}}
  private async locks(tx:Prisma.TransactionClient,keys:readonly string[]){for(const key of [...new Set(keys)].sort())await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;}
  private scope(companyId:string,branchId:string){return `${companyId}:${branchId}`; }

  async createRun(value:TransportRun,history:TransportHistory){
    await this.db.$transaction([this.db.hutrRun.create({data:this.runData(value)}),this.db.hutrHistory.create({data:this.historyData(history)})]);
    return value;
  }
  async saveRun(value:TransportRun,history:TransportHistory){
    return this.db.$transaction(async tx=>{
      const scope=this.scope(value.companyId,value.branchId);
      await this.locks(tx,[`hutr:allocation:${scope}:${value.allocationId}`,`hutr:run:${scope}:${value.id}`]);
      const current=await tx.hutrRun.findUnique({where:{id_companyId_branchId:{id:value.id,companyId:value.companyId,branchId:value.branchId}}});
      if(!current)throw new ContractValidationError('runId','transport run not found');
      const updated=await tx.hutrRun.update({where:{id_companyId_branchId:{id:value.id,companyId:value.companyId,branchId:value.branchId}},data:this.runData(value)});
      await tx.hutrHistory.create({data:this.historyData(history)});
      return runMap(updated);
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }
  async getRun(companyId:string,branchId:string,id:string){const row=await this.db.hutrRun.findUnique({where:{id_companyId_branchId:{id,companyId,branchId}}});return row?runMap(row):null;}
  async listRuns(companyId:string,branchId:string,programId?:string){return(await this.db.hutrRun.findMany({where:{companyId,branchId,...(programId?{programId}:{})},orderBy:{startsAt:'asc'}})).map(runMap);}

  async assignGuarded(value:ManifestAssignment,history:TransportHistory,run:TransportRun,capacity:number){
    return this.db.$transaction(async tx=>{
      const scope=this.scope(value.companyId,value.branchId);
      await this.locks(tx,[`hutr:allocation:${scope}:${run.allocationId}`,`hutr:traveler:${scope}:${value.travelerId}`,`hutr:run:${scope}:${run.id}`]);
      const currentRun=await tx.hutrRun.findUnique({where:{id_companyId_branchId:{id:run.id,companyId:run.companyId,branchId:run.branchId}}});
      if(!currentRun||currentRun.status!=='SCHEDULED')throw new ContractValidationError('status','manifest can only change before dispatch');

      const existing=await tx.hutrManifestAssignment.findUnique({where:{companyId_branchId_runId_travelerId:{companyId:value.companyId,branchId:value.branchId,runId:value.runId,travelerId:value.travelerId}}});
      if(existing&&existing.bookingId!==value.bookingId)throw new ContractValidationError('bookingId','retained manifest identity belongs to another booking');
      if(existing?.status==='ASSIGNED')return assignmentMap(existing);

      const conflict=await tx.hutrManifestAssignment.findFirst({where:{
        companyId:value.companyId,branchId:value.branchId,travelerId:value.travelerId,status:'ASSIGNED',
        run:{id:{not:run.id},status:{in:['SCHEDULED','DISPATCHED']},startsAt:{lt:new Date(run.endsAt)},endsAt:{gt:new Date(run.startsAt)}},
      }});
      if(conflict)throw new ContractValidationError('travelerId','traveler already has a conflicting transport run');

      const used=await tx.hutrManifestAssignment.count({where:{
        companyId:value.companyId,branchId:value.branchId,status:'ASSIGNED',
        run:{allocationId:run.allocationId,status:{in:['SCHEDULED','DISPATCHED']},startsAt:{lt:new Date(run.endsAt)},endsAt:{gt:new Date(run.startsAt)}},
      }});
      if(used>=capacity)throw new ContractValidationError('capacity','transport allocation capacity exceeded across overlapping runs');

      if(existing){
        const reactivated=await tx.hutrManifestAssignment.update({where:{id_companyId_branchId:{id:existing.id,companyId:existing.companyId,branchId:existing.branchId}},data:{status:'ASSIGNED',updatedAt:new Date(value.updatedAt)}});
        await tx.hutrHistory.create({data:this.historyData({...history,aggregateId:existing.id,action:'REACTIVATED',evidence:{runId:run.id,travelerId:value.travelerId}})});
        return assignmentMap(reactivated);
      }

      await tx.hutrManifestAssignment.create({data:this.assignmentData(value)});
      await tx.hutrHistory.create({data:this.historyData(history)});
      return value;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  async saveAssignment(value:ManifestAssignment,history:TransportHistory){
    return this.db.$transaction(async tx=>{
      const run=await tx.hutrRun.findUnique({where:{id_companyId_branchId:{id:value.runId,companyId:value.companyId,branchId:value.branchId}}});
      if(!run)throw new ContractValidationError('runId','transport run not found');
      const scope=this.scope(value.companyId,value.branchId);
      await this.locks(tx,[`hutr:allocation:${scope}:${run.allocationId}`,`hutr:traveler:${scope}:${value.travelerId}`,`hutr:run:${scope}:${run.id}`]);
      const updated=await tx.hutrManifestAssignment.update({where:{id_companyId_branchId:{id:value.id,companyId:value.companyId,branchId:value.branchId}},data:this.assignmentData(value)});
      await tx.hutrHistory.create({data:this.historyData(history)});
      return assignmentMap(updated);
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  async manifest(companyId:string,branchId:string,runId:string){return(await this.db.hutrManifestAssignment.findMany({where:{companyId,branchId,runId},orderBy:{createdAt:'asc'}})).map(assignmentMap);}
  async activeManifestCount(companyId:string,branchId:string,runId:string){return this.db.hutrManifestAssignment.count({where:{companyId,branchId,runId,status:'ASSIGNED'}});}
  async history(companyId:string,branchId:string,type:'RUN'|'MANIFEST',id:string){return(await this.db.hutrHistory.findMany({where:{companyId,branchId,aggregateType:type,aggregateId:id},orderBy:{occurredAt:'asc'}})).map(historyMap);}
}
