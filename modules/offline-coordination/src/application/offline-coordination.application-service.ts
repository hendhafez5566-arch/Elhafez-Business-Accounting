import { createHash, randomUUID } from 'node:crypto';
import { ContractValidationError, executionContext, type ExecutionContext } from '@elhafez/contracts';
import { assertGrant, OFFLINE_OPERATIONS, type DeviceGrant, type OfflineCommand, type OfflineOperation } from '../domain/coordination.js';
import type { CoordinationAccess, CoordinationOwner, CoordinationRepository } from './coordination.ports.js';
export interface SubmitOfflineCommand {
 readonly id:string;readonly deviceId:string;readonly grantId:string;readonly operation:OfflineOperation;
 readonly payload:unknown;readonly dependencies:readonly string[];readonly capturedAt:string;
}
function identity(value:string,field:string){if(typeof value!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{15,127}$/.test(value))throw new ContractValidationError(field,'stable identity of 16..128 characters required');return value;}
function canonical(value:unknown):string {
 if(value===null||typeof value!=='object'){const result=JSON.stringify(value);if(result===undefined)throw new ContractValidationError('payload','JSON required');return result;}
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>JSON.stringify(key)+':'+canonical(v)).join(',')+'}';
}
export class OfflineCoordinationApplicationService {
 constructor(private readonly repo:CoordinationRepository,private readonly access:CoordinationAccess,private readonly owner:CoordinationOwner,private readonly now:()=>Date=()=>new Date(),private readonly newId:()=>string=()=>randomUUID()){}
 async delegate(c:ExecutionContext,input:{deviceId:string;operations:readonly OfflineOperation[];durationMinutes:number}):Promise<DeviceGrant>{
  await this.access.requireContext(c);identity(input.deviceId,'deviceId');
  if(!Array.isArray(input.operations)||!input.operations.length||new Set(input.operations).size!==input.operations.length||input.operations.some(x=>!OFFLINE_OPERATIONS.includes(x)))throw new ContractValidationError('operations','explicit supported operation list required');
  if(!Number.isInteger(input.durationMinutes)||input.durationMinutes<1||input.durationMinutes>480)throw new ContractValidationError('duration','delegation must be 1..480 minutes');
  for(const op of input.operations)await this.access.authorize(c,op);
  const at=this.now();const grant:DeviceGrant={id:this.newId(),companyId:c.companyId,branchId:c.branchId,actorId:c.actorId,deviceId:input.deviceId,operations:[...input.operations],issuedAt:at.toISOString(),expiresAt:new Date(at.getTime()+input.durationMinutes*60000).toISOString(),revokedAt:null};
  await this.repo.saveGrant(grant);return grant;
 }
 async revoke(c:ExecutionContext,id:string){await this.access.requireContext(c);await this.repo.revoke(c,id,this.now().toISOString());}
 async list(c:ExecutionContext){await this.access.requireContext(c);return this.repo.list(c);}
 async reviewQueue(c:ExecutionContext){await this.access.requireContext(c);await this.access.authorizeReview(c);return this.repo.listReview(c);}
 async resolveReview(c:ExecutionContext,id:string,reason:string):Promise<OfflineCommand>{
  await this.access.requireContext(c);await this.access.authorizeReview(c);identity(id,'id');
  if(typeof reason!=='string'||reason.trim().length<10||reason.trim().length>2000)throw new ContractValidationError('reason','review reason of 10..2000 characters required');
  const pending=(await this.repo.listReview(c)).find(x=>x.id===id);
  if(!pending)throw new ContractValidationError('review','request is not awaiting review');
  await this.access.authorize(c,pending.operation);
  const at=this.now(),command=await this.repo.claimReview(c,id,reason.trim(),at.toISOString(),new Date(at.getTime()+60000).toISOString());
  if(!command)throw new ContractValidationError('review','another reviewer has already claimed this request');
  try{
   const originalContext=executionContext(c.companyId,c.branchId,command.actorId);
   for(const dependency of command.dependencies){const prior=await this.repo.get(originalContext,dependency);if(prior?.state!=='ACCEPTED')throw new ContractValidationError('dependency','resolve prerequisite first');}
   // Explicit authorized review replaces the expired device delegation, never the owner's controls.
   const result=await this.owner.execute(c,command);
   return await this.repo.finish(command,'ACCEPTED',result,null);
  }catch(error){
   await this.repo.finish(command,'REVIEW',null,error instanceof Error?error.message:'OWNER_OUTCOME_UNCONFIRMED');
   throw error;
  }
 }
 private async reserve(c:ExecutionContext,input:SubmitOfflineCommand){
  identity(input.id,'id');identity(input.deviceId,'deviceId');identity(input.grantId,'grantId');
  if(!OFFLINE_OPERATIONS.includes(input.operation))throw new ContractValidationError('operation','unsupported operation');
  if(!Array.isArray(input.dependencies)||input.dependencies.length>32||new Set(input.dependencies).size!==input.dependencies.length)throw new ContractValidationError('dependencies','at most 32 distinct identities required');
  for(const id of input.dependencies){identity(id,'dependency');if(id===input.id)throw new ContractValidationError('dependencies','self dependency prohibited');}
  const payloadText=canonical(input.payload);
  if(Buffer.byteLength(payloadText)>65536)throw new ContractValidationError('payload','command exceeds 64 KiB; use file owner for attachments');
  const payloadHash=createHash('sha256').update(canonical({actorId:c.actorId,deviceId:input.deviceId,grantId:input.grantId,operation:input.operation,payload:input.payload,dependencies:input.dependencies,capturedAt:input.capturedAt})).digest('hex');
  // Receipt is durable before authorization checks: observed cash survives a denial as REVIEW,
  // without claiming a Treasury posting or settlement occurred.
  const value=await this.repo.reserve({id:input.id,companyId:c.companyId,branchId:c.branchId,actorId:c.actorId,deviceId:input.deviceId,grantId:input.grantId,operation:input.operation,payload:JSON.parse(payloadText),payloadHash,dependencies:[...input.dependencies],capturedAt:input.capturedAt,receivedAt:this.now().toISOString(),state:'PENDING',attempt:0,leaseUntil:null,result:null,reason:null});
  if(value.payloadHash!==payloadHash)throw new ContractValidationError('id','conflicting replay; original request retained');
  return value;
 }
 async intakeCash(c:ExecutionContext,originalActorId:string,input:SubmitOfflineCommand){
  await this.access.requireContext(c);await this.access.authorizeReview(c);
  if(input.operation!=='BOOKING_DEPOSIT')throw new ContractValidationError('operation','supervised intake accepts observed cash only');
  const original=executionContext(c.companyId,c.branchId,originalActorId),grant=await this.repo.grant(original,input.grantId);
  if(!grant||grant.deviceId!==input.deviceId||!grant.operations.includes('BOOKING_DEPOSIT'))throw new ContractValidationError('grant','original scoped cash delegation required');
  const value=await this.reserve(original,input);
  if(value.state==='ACCEPTED'||value.state==='REVIEW')return value;
  const at=this.now(),claimed=await this.repo.claim(original,value.id,at.toISOString(),new Date(at.getTime()+60000).toISOString());
  if(!claimed)return value;
  return this.repo.finish(claimed,'REVIEW',null,'SUPERVISED_CASH_INTAKE: original employee and immutable receipt retained; explicit resolution required');
 }
 async submit(c:ExecutionContext,input:SubmitOfflineCommand):Promise<OfflineCommand>{
  await this.access.requireContext(c);
  const value=await this.reserve(c,input);
  if(value.state==='ACCEPTED'){await this.access.authorize(c,value.operation);return value;}
  if(value.state==='REVIEW')return value;
  const at=this.now();const command=await this.repo.claim(c,value.id,at.toISOString(),new Date(at.getTime()+60000).toISOString());
  if(!command)return (await this.repo.get(c,value.id))!;
  try{
   assertGrant(await this.repo.grant(c,command.grantId),command,this.now());
   await this.access.authorize(c,command.operation);
   for(const id of command.dependencies){const prior=await this.repo.get(c,id);if(prior?.state!=='ACCEPTED')return this.repo.finish(command,'PENDING',null,'DEPENDENCY_PENDING');}
   const result=await this.owner.execute(c,command);
   return await this.repo.finish(command,'ACCEPTED',result,null);
  }catch(error){
   if(error instanceof ContractValidationError)return this.repo.finish(command,'REVIEW',null,error.message);
   // Unknown outcome is retryable with the original identity; never represent it as success.
   await this.repo.finish(command,'PENDING',null,'OWNER_OUTCOME_UNCONFIRMED');
   throw error;
  }
 }
}
