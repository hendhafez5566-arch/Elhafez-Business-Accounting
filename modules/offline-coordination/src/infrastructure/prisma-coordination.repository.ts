import { Prisma, type PrismaClient, type OcCommand, type OcDeviceGrant } from '@prisma/client';
import { ContractValidationError, type ExecutionContext } from '@elhafez/contracts';
import type { CoordinationRepository } from '../application/coordination.ports.js';
import type { DeviceGrant, OfflineCommand } from '../domain/coordination.js';
const json=(value:unknown)=>value===null?Prisma.JsonNull:value as Prisma.InputJsonValue;
const scope=(c:ExecutionContext)=>({companyId:c.companyId,branchId:c.branchId,actorId:c.actorId});
function command(row:OcCommand):OfflineCommand{return {...row,reviewHistory:row.reviewHistory as unknown as NonNullable<OfflineCommand['reviewHistory']>,operation:row.operation as OfflineCommand['operation'],state:row.state as OfflineCommand['state'],dependencies:row.dependencies as string[],receivedAt:row.receivedAt.toISOString(),leaseUntil:row.leaseUntil?.toISOString()??null};}
function grant(row:OcDeviceGrant):DeviceGrant{return {...row,operations:row.operations as DeviceGrant['operations'],issuedAt:row.issuedAt.toISOString(),expiresAt:row.expiresAt.toISOString(),revokedAt:row.revokedAt?.toISOString()??null};}
export class PrismaCoordinationRepository implements CoordinationRepository {
 constructor(private readonly db:PrismaClient){}
 async listReview(c:ExecutionContext){return(await this.db.ocCommand.findMany({where:{companyId:c.companyId,branchId:c.branchId,OR:[{state:'REVIEW'},{state:'PROCESSING',leaseUntil:{lte:new Date()},NOT:{reviewHistory:{equals:[]}}}]},orderBy:{receivedAt:'asc'},take:200})).map(command);}
 async claimReview(c:ExecutionContext,id:string,reason:string,at:string,until:string){
  return this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM oc_commands WHERE company_id=${c.companyId} AND branch_id=${c.branchId} AND id=${id} FOR UPDATE`;
   const row=await tx.ocCommand.findUnique({where:{companyId_branchId_id:{companyId:c.companyId,branchId:c.branchId,id}}});
   if(!row||!(row.state==='REVIEW'||row.state==='PROCESSING'&&row.leaseUntil&&row.leaseUntil<=new Date(at)&&command(row).reviewHistory?.length))return undefined;
   const history=command(row).reviewHistory??[];
   return command(await tx.ocCommand.update({where:{companyId_branchId_id:{companyId:c.companyId,branchId:c.branchId,id}},data:{state:'PROCESSING',attempt:{increment:1},leaseUntil:new Date(until),reviewHistory:json([...history,{reviewerId:c.actorId,previousReason:row.reason,reason,at,attempt:row.attempt+1}])}}));
  });
 }
 async saveGrant(v:DeviceGrant){await this.db.ocDeviceGrant.create({data:{id:v.id,companyId:v.companyId,branchId:v.branchId,actorId:v.actorId,deviceId:v.deviceId,operations:json(v.operations),issuedAt:new Date(v.issuedAt),expiresAt:new Date(v.expiresAt),revokedAt:null}});}
 async grant(c:ExecutionContext,id:string){const row=await this.db.ocDeviceGrant.findFirst({where:{...scope(c),id}});return row?grant(row):undefined;}
 async revoke(c:ExecutionContext,id:string,at:string){await this.db.ocDeviceGrant.updateMany({where:{...scope(c),id,revokedAt:null},data:{revokedAt:new Date(at)}});}
 async reserve(v:OfflineCommand){
  try{const row=await this.db.ocCommand.create({data:{id:v.id,companyId:v.companyId,branchId:v.branchId,actorId:v.actorId,deviceId:v.deviceId,grantId:v.grantId,operation:v.operation,payload:json(v.payload),payloadHash:v.payloadHash,dependencies:json(v.dependencies),capturedAt:v.capturedAt,receivedAt:new Date(v.receivedAt),state:'PENDING',attempt:0,result:Prisma.JsonNull,reason:null,leaseUntil:null}});return command(row);}
  catch(error){const row=await this.db.ocCommand.findUnique({where:{companyId_branchId_id:{companyId:v.companyId,branchId:v.branchId,id:v.id}}});if(!row)throw error;if(row.actorId!==v.actorId)throw new ContractValidationError('id','request identity already in use');return command(row);}
 }
 async get(c:ExecutionContext,id:string){const row=await this.db.ocCommand.findFirst({where:{...scope(c),id}});return row?command(row):undefined;}
 async list(c:ExecutionContext){return(await this.db.ocCommand.findMany({where:scope(c),orderBy:{receivedAt:'desc'},take:200})).map(command);}
 async claim(c:ExecutionContext,id:string,at:string,until:string){
  const result=await this.db.ocCommand.updateMany({where:{...scope(c),id,OR:[{state:'PENDING'},{state:'PROCESSING',leaseUntil:{lte:new Date(at)}}]},data:{state:'PROCESSING',attempt:{increment:1},leaseUntil:new Date(until),reason:null}});
  return result.count===1?this.get(c,id):undefined;
 }
 async finish(v:OfflineCommand,state:'PENDING'|'ACCEPTED'|'REVIEW',result:unknown,reason:string|null){
  await this.db.ocCommand.updateMany({where:{companyId:v.companyId,branchId:v.branchId,actorId:v.actorId,id:v.id,state:'PROCESSING',attempt:v.attempt},data:{state,result:json(result),reason,leaseUntil:null}});
  const row=await this.db.ocCommand.findUniqueOrThrow({where:{companyId_branchId_id:{companyId:v.companyId,branchId:v.branchId,id:v.id}}});return command(row);
 }
}
