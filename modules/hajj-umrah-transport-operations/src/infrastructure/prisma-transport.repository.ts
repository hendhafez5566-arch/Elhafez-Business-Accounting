import { Prisma, type HutrHistory, type HutrManifestAssignment, type HutrRun, type PrismaClient } from '@prisma/client';
import { ContractValidationError, companyId } from '@elhafez/contracts';
import type { ManifestAssignment, TransportHistory, TransportRun, TransportRunStatus } from '../domain/transport.js';
import type { TransportRepository } from '../application/transport.repository.js';

const json=(value:unknown)=>value as Prisma.InputJsonValue;
const runMap=(row:HutrRun):TransportRun=>({
  id:row.id,companyId:companyId(row.companyId),branchId:row.branchId,programId:row.programId,allocationId:row.allocationId,
  code:row.code,route:row.route,startsAt:row.startsAt.toISOString(),endsAt:row.endsAt.toISOString(),
  ...(row.vehicleReference?{vehicleReference:row.vehicleReference}:{}),...(row.driverReference?{driverReference:row.driverReference}:{}),
  status:row.status as TransportRun['status'],revision:row.revision,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString(),
});
const assignmentMap=(row:HutrManifestAssignment):ManifestAssignment=>({
  id:row.id,companyId:companyId(row.companyId),branchId:row.branchId,runId:row.runId,bookingId:row.bookingId,travelerId:row.travelerId,
  status:row.status as ManifestAssignment['status'],revision:row.revision,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString(),
});
const historyMap=(row:HutrHistory):TransportHistory=>({
  id:row.id,companyId:companyId(row.companyId),branchId:row.branchId,aggregateType:row.aggregateType as TransportHistory['aggregateType'],
  aggregateId:row.aggregateId,action:row.action,...(row.evidence!==null?{evidence:row.evidence}:{}),actorId:row.actorId,occurredAt:row.occurredAt.toISOString(),
});

export class PrismaTransportRepository implements TransportRepository{
  constructor(private readonly db:PrismaClient){}
  private runData(value:TransportRun){return{
    id:value.id,companyId:value.companyId,branchId:value.branchId,programId:value.programId,allocationId:value.allocationId,code:value.code,route:value.route,
    startsAt:new Date(value.startsAt),endsAt:new Date(value.endsAt),vehicleReference:value.vehicleReference??null,driverReference:value.driverReference??null,
    status:value.status,revision:value.revision,createdAt:new Date(value.createdAt),updatedAt:new Date(value.updatedAt),
  }}
  private assignmentData(value:ManifestAssignment){return{
    id:value.id,companyId:value.companyId,branchId:value.branchId,runId:value.runId,bookingId:value.bookingId,travelerId:value.travelerId,
    status:value.status,revision:value.revision,createdAt:new Date(value.createdAt),updatedAt:new Date(value.updatedAt),
  }}
  private historyData(value:TransportHistory){return{
    id:value.id,companyId:value.companyId,branchId:value.branchId,aggregateType:value.aggregateType,aggregateId:value.aggregateId,action:value.action,
    evidence:value.evidence===undefined?Prisma.JsonNull:json(value.evidence),actorId:value.actorId,occurredAt:new Date(value.occurredAt),
  }}
  private async serializable<T>(work:(tx:Prisma.TransactionClient)=>Promise<T>):Promise<T>{
    try{return await this.db.$transaction(work,{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});}
    catch(error){
      if((error as {code?:string}).code==='P2034')throw new ContractValidationError('revision','transport state changed; reload and retry');
      throw error;
    }
  }
  private async locks(tx:Prisma.TransactionClient,keys:readonly string[]){
    for(const key of [...new Set(keys)].sort())await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`);
  }
  private scope(companyId:string,branchId:string){return `${companyId}:${branchId}`;}
  private stale(kind:'run'|'manifest',expected:number,actual:number){
    if(actual!==expected)throw new ContractValidationError('revision',`${kind} changed; reload and retry`);
  }

  async createRun(value:TransportRun,history:TransportHistory){
    return this.serializable(async tx=>{
      const created=await tx.hutrRun.create({data:this.runData(value)});
      await tx.hutrHistory.create({data:this.historyData(history)});
      return runMap(created);
    });
  }

  async saveRun(value:TransportRun,history:TransportHistory,expectedRevision:number,expectedStatus:TransportRunStatus){
    return this.serializable(async tx=>{
      const scope=this.scope(value.companyId,value.branchId);
      await this.locks(tx,[`hutr:allocation:${scope}:${value.allocationId}`,`hutr:run:${scope}:${value.id}`]);
      const current=await tx.hutrRun.findUnique({where:{id_companyId_branchId:{id:value.id,companyId:value.companyId,branchId:value.branchId}}});
      if(!current)throw new ContractValidationError('runId','transport run not found');
      this.stale('run',expectedRevision,current.revision);
      if(current.status!==expectedStatus)throw new ContractValidationError('status','transport run changed; reload and retry');
      const write=await tx.hutrRun.updateMany({
        where:{id:value.id,companyId:value.companyId,branchId:value.branchId,revision:expectedRevision,status:expectedStatus},
        data:this.runData(value),
      });
      if(write.count!==1)throw new ContractValidationError('revision','run changed; reload and retry');
      await tx.hutrHistory.create({data:this.historyData(history)});
      return value;
    });
  }

  async getRun(companyId:string,branchId:string,id:string){
    const row=await this.db.hutrRun.findUnique({where:{id_companyId_branchId:{id,companyId,branchId}}});
    return row?runMap(row):null;
  }
  async listRuns(companyId:string,branchId:string,programId?:string){
    return(await this.db.hutrRun.findMany({where:{companyId,branchId,...(programId?{programId}:{})},orderBy:{startsAt:'asc'}})).map(runMap);
  }

  async assignGuarded(value:ManifestAssignment,history:TransportHistory,run:TransportRun,capacity:number){
    return this.serializable(async tx=>{
      const scope=this.scope(value.companyId,value.branchId);
      await this.locks(tx,[`hutr:allocation:${scope}:${run.allocationId}`,`hutr:traveler:${scope}:${value.travelerId}`,`hutr:run:${scope}:${run.id}`]);
      const currentRun=await tx.hutrRun.findUnique({where:{id_companyId_branchId:{id:run.id,companyId:run.companyId,branchId:run.branchId}}});
      if(!currentRun)throw new ContractValidationError('runId','transport run not found');
      this.stale('run',run.revision,currentRun.revision);
      if(currentRun.status!=='SCHEDULED')throw new ContractValidationError('status','manifest can only change before dispatch');

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
        const reactivatedRevision=existing.revision+1;
        const write=await tx.hutrManifestAssignment.updateMany({
          where:{id:existing.id,companyId:existing.companyId,branchId:existing.branchId,revision:existing.revision,status:'REMOVED'},
          data:{status:'ASSIGNED',revision:reactivatedRevision,updatedAt:new Date(value.updatedAt)},
        });
        if(write.count!==1)throw new ContractValidationError('revision','manifest changed; reload and retry');
        await tx.hutrHistory.create({data:this.historyData({...history,aggregateId:existing.id,action:'REACTIVATED',evidence:{runId:run.id,travelerId:value.travelerId}})});
        return assignmentMap({...existing,status:'ASSIGNED',revision:reactivatedRevision,updatedAt:new Date(value.updatedAt)});
      }

      const created=await tx.hutrManifestAssignment.create({data:this.assignmentData(value)});
      await tx.hutrHistory.create({data:this.historyData(history)});
      return assignmentMap(created);
    });
  }

  async saveAssignment(value:ManifestAssignment,history:TransportHistory,expectedRevision:number,expectedRun:TransportRun){
    return this.serializable(async tx=>{
      if(expectedRun.id!==value.runId)throw new ContractValidationError('runId','expected run does not match manifest assignment');
      const scope=this.scope(value.companyId,value.branchId);
      await this.locks(tx,[`hutr:allocation:${scope}:${expectedRun.allocationId}`,`hutr:traveler:${scope}:${value.travelerId}`,`hutr:run:${scope}:${expectedRun.id}`]);

      const currentRun=await tx.hutrRun.findUnique({where:{id_companyId_branchId:{id:expectedRun.id,companyId:value.companyId,branchId:value.branchId}}});
      if(!currentRun)throw new ContractValidationError('runId','transport run not found');
      this.stale('run',expectedRun.revision,currentRun.revision);
      if(currentRun.status!=='SCHEDULED')throw new ContractValidationError('status','manifest can only change before dispatch');

      const current=await tx.hutrManifestAssignment.findUnique({where:{id_companyId_branchId:{id:value.id,companyId:value.companyId,branchId:value.branchId}}});
      if(!current)throw new ContractValidationError('assignmentId','manifest assignment not found');
      this.stale('manifest',expectedRevision,current.revision);
      if(current.status!=='ASSIGNED')throw new ContractValidationError('status','manifest assignment is no longer active');

      const write=await tx.hutrManifestAssignment.updateMany({
        where:{id:value.id,companyId:value.companyId,branchId:value.branchId,revision:expectedRevision,status:'ASSIGNED'},
        data:this.assignmentData(value),
      });
      if(write.count!==1)throw new ContractValidationError('revision','manifest changed; reload and retry');
      await tx.hutrHistory.create({data:this.historyData(history)});
      return value;
    });
  }

  async manifest(companyId:string,branchId:string,runId:string){
    return(await this.db.hutrManifestAssignment.findMany({where:{companyId,branchId,runId},orderBy:{createdAt:'asc'}})).map(assignmentMap);
  }
  async activeManifestCount(companyId:string,branchId:string,runId:string){
    return this.db.hutrManifestAssignment.count({where:{companyId,branchId,runId,status:'ASSIGNED'}});
  }
  async history(companyId:string,branchId:string,type:'RUN'|'MANIFEST',id:string){
    return(await this.db.hutrHistory.findMany({where:{companyId,branchId,aggregateType:type,aggregateId:id},orderBy:{occurredAt:'asc'}})).map(historyMap);
  }
}
