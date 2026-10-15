import test from 'node:test';
import assert from 'node:assert/strict';
import { ContractValidationError, executionContext, type ExecutionContext } from '@elhafez/contracts';
import { OfflineCoordinationApplicationService, type SubmitOfflineCommand } from './application/offline-coordination.application-service.js';
import type { CoordinationRepository, CoordinationAccess, CoordinationOwner } from './application/coordination.ports.js';
import type { DeviceGrant, OfflineCommand, OfflineOperation } from './domain/coordination.js';
class Repository implements CoordinationRepository {
 grants=new Map<string,DeviceGrant>();commands=new Map<string,OfflineCommand>();failFinish=false;
 key(c:{companyId:string;branchId:string},id:string){return JSON.stringify([c.companyId,c.branchId,id]);}
 async saveGrant(v:DeviceGrant){this.grants.set(v.id,structuredClone(v));}
 async grant(c:ExecutionContext,id:string){const v=this.grants.get(id);return v&&v.companyId===c.companyId&&v.branchId===c.branchId&&v.actorId===c.actorId?structuredClone(v):undefined;}
 async revoke(c:ExecutionContext,id:string,at:string){const v=await this.grant(c,id);if(v)this.grants.set(id,{...v,revokedAt:at});}
 async reserve(v:OfflineCommand){const key=this.key(v,v.id),old=this.commands.get(key);if(old?.actorId&&old.actorId!==v.actorId)throw new ContractValidationError('id','request identity already in use');if(!old)this.commands.set(key,structuredClone(v));return structuredClone(old??v);}
 async get(c:ExecutionContext,id:string){const v=this.commands.get(this.key(c,id));return v?.actorId===c.actorId?structuredClone(v):undefined;}
 async list(c:ExecutionContext){return [...this.commands.values()].filter(x=>x.companyId===c.companyId&&x.branchId===c.branchId&&x.actorId===c.actorId).map(x=>structuredClone(x));}
 async claim(c:ExecutionContext,id:string,at:string,until:string){const v=await this.get(c,id);if(!v||v.state!=='PENDING'&&!(v.state==='PROCESSING'&&v.leaseUntil!<=at))return;const key=this.key(c,id),actual=this.commands.get(key)!;if(actual.attempt!==v.attempt)return;const next={...v,state:'PROCESSING' as const,attempt:v.attempt+1,leaseUntil:until};this.commands.set(key,next);return structuredClone(next);}
 async finish(v:OfflineCommand,state:'PENDING'|'ACCEPTED'|'REVIEW',result:unknown,reason:string|null){if(this.failFinish&&state==='ACCEPTED'){this.failFinish=false;throw Error('lost local completion');}const key=this.key(v,v.id),old=this.commands.get(key)!;if(old.attempt===v.attempt&&old.state==='PROCESSING')this.commands.set(key,{...old,state,result,reason,leaseUntil:null});return structuredClone(this.commands.get(key)!);}
}
const c=executionContext('company-a','branch-a','actor-a');
function fixture(){const repo=new Repository();let date=new Date('2026-10-15T10:00:00Z'),denied=false;const effects=new Map<string,unknown>();
 const access:CoordinationAccess={async requireContext(){},async authorize(){if(denied)throw new ContractValidationError('permission','permission revoked');}};
 const owner:CoordinationOwner={async execute(_c,cmd){if(!effects.has(cmd.id))effects.set(cmd.id,{ownerReference:'owner-'+cmd.id});return effects.get(cmd.id);}};
 const make=()=>new OfflineCoordinationApplicationService(repo,access,owner,()=>date);
 const service=make();const deviceId='device-0000000000000001';
 const grant=(operations:OfflineOperation[]=['BOOKING_CREATE'])=>service.delegate(c,{deviceId,operations,durationMinutes:60});
 const input=(g:DeviceGrant,id='request-000000000000001'):SubmitOfflineCommand=>({id,deviceId,grantId:g.id,operation:'BOOKING_CREATE',payload:{code:'B-1'},dependencies:[],capturedAt:date.toISOString()});
 return{repo,service,make,grant,input,effects,setDate:(v:string)=>date=new Date(v),deny:()=>denied=true};}
test('stable command identity, reordered JSON and concurrent retries converge on one owner effect',async()=>{const f=fixture(),g=await f.grant(),i=f.input(g);const values=await Promise.all([f.service.submit(c,i),f.service.submit(c,i)]);assert.equal(f.effects.size,1);assert.ok(values.some(x=>x.state==='ACCEPTED'));assert.equal((await f.make().submit(c,i)).state,'ACCEPTED');assert.equal(f.effects.size,1);await assert.rejects(()=>f.service.submit(c,{...i,payload:{code:'changed'}}),/conflicting replay/);});
test('owner success and lost coordinator completion retry original identity after restart',async()=>{const f=fixture(),g=await f.grant(),i=f.input(g);f.repo.failFinish=true;await assert.rejects(()=>f.service.submit(c,i),/lost local completion/);assert.equal(f.effects.size,1);assert.equal((await f.make().submit(c,i)).state,'ACCEPTED');assert.equal(f.effects.size,1);});
test('expired delegation retains observed cash request for review without any economic effect',async()=>{const f=fixture(),g=await f.grant(['BOOKING_DEPOSIT']);const i={...f.input(g),operation:'BOOKING_DEPOSIT' as const,payload:{observedCash:'100',receipt:'PROVISIONAL-1'}};f.setDate('2026-10-15T11:01:00Z');const result=await f.service.submit(c,i);assert.equal(result.state,'REVIEW');assert.deepEqual(result.payload,i.payload);assert.match(result.reason!,/expired/);assert.equal(f.effects.size,0);});
test('scope mismatch and revocation never call owners',async()=>{const f=fixture(),g=await f.grant(),i=f.input(g);const mismatch=await f.service.submit(executionContext('other','branch-a','actor-a'),i);assert.equal(mismatch.state,'REVIEW');await f.service.revoke(c,g.id);assert.equal((await f.service.submit(c,i)).state,'REVIEW');assert.equal(f.effects.size,0);assert.equal((await f.service.list(executionContext('company-a','other','actor-a'))).length,0);});
test('permission is rechecked at sync and retained cash is not posted',async()=>{const f=fixture(),g=await f.grant(),i=f.input(g);f.deny();assert.equal((await f.service.submit(c,i)).state,'REVIEW');assert.equal(f.effects.size,0);});
test('dependency order prevents child owner execution until prerequisite accepted',async()=>{const f=fixture(),g=await f.grant();const first=f.input(g),second={...f.input(g,'request-000000000000002'),dependencies:[first.id]};assert.equal((await f.service.submit(c,second)).state,'PENDING');assert.equal(f.effects.size,0);await f.service.submit(c,first);assert.equal((await f.service.submit(c,second)).state,'ACCEPTED');assert.equal(f.effects.size,2);});
test('clock rollback, future capture and delegated operation mismatch require review',async()=>{for(const change of [{capturedAt:'2026-10-15T09:59:59Z'},{capturedAt:'2026-10-15T12:00:00Z'},{operation:'BOOKING_CONFIRM' as const}]){const f=fixture(),g=await f.grant();assert.equal((await f.service.submit(c,{...f.input(g),...change})).state,'REVIEW');assert.equal(f.effects.size,0);}});
test('unbounded or duplicate delegations are rejected',async()=>{const f=fixture();await assert.rejects(()=>f.service.delegate(c,{deviceId:'device-0000000000000001',operations:['BOOKING_CREATE'],durationMinutes:481}),/480/);});
