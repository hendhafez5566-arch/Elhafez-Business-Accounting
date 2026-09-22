import assert from'node:assert/strict';
import test from'node:test';
import{UnauthorizedException}from'@nestjs/common';
import{PlatformError}from'@elhafez/platform-core';
import{HajjUmrahReadinessController}from'./hajj-umrah-readiness.controller.js';

function fixture(){
 const calls:Array<{name:string;context?:{companyId:string;branchId:string;actorId:string};id?:string;permission?:string}>=[];
 const readiness={
  async bookingReadiness(context:{companyId:string;branchId:string;actorId:string},id:string){calls.push({name:'bookingReadiness',context,id});return{status:'READY',blockers:[],evidenceReferences:[]}},
  async programReadiness(context:{companyId:string;branchId:string;actorId:string},id:string){calls.push({name:'programReadiness',context,id});return{status:'READY',blockers:[],evidenceReferences:[],bookingResults:{}}},
  async booking360(context:{companyId:string;branchId:string;actorId:string},id:string){calls.push({name:'booking360',context,id});return{id}},
  async program360(context:{companyId:string;branchId:string;actorId:string},id:string){calls.push({name:'program360',context,id});return{id}},
  async workQueue(context:{companyId:string;branchId:string;actorId:string},id:string){calls.push({name:'workQueue',context,id});return[]},
  async reports(context:{companyId:string;branchId:string;actorId:string},id:string){calls.push({name:'reports',context,id});return{id}},
  async evaluateClosure(context:{companyId:string;branchId:string;actorId:string},id:string){calls.push({name:'evaluateClosure',context,id});return{canClose:true,program:{id},blockers:[],evidenceReferences:[]}},
  async closeProgram(context:{companyId:string;branchId:string;actorId:string},id:string){calls.push({name:'closeProgram',context,id});return{closed:true,program:{id},blockers:[]}},
 };
 const denied=new Set<string>();
 const platform={
  async currentUser(token:string){calls.push({name:'currentUser',id:token});return{id:'user-1'}},
  async requireBranchAccess(actorId:string,companyId:string,branchId:string){calls.push({name:'requireBranchAccess',context:{actorId,companyId,branchId}})},
  async authorize(_actorId:string,_companyId:string,permission:string){calls.push({name:'authorize',permission});if(denied.has(permission))throw new PlatformError('FORBIDDEN','denied')},
 };
 return{controller:new HajjUmrahReadinessController(readiness as never,platform as never),calls,denied};
}

test('HU-03 API requires authenticated company and branch context before delegation',async()=>{
 const{controller,calls}=fixture();
 await assert.rejects(()=>controller.programReadiness(undefined,'c1','b1','p1'),error=>error instanceof UnauthorizedException);
 await assert.rejects(()=>controller.programReadiness('Bearer token',undefined,'b1','p1'),error=>error instanceof UnauthorizedException);
 await assert.rejects(()=>controller.programReadiness('Bearer token','c1',undefined,'p1'),error=>error instanceof UnauthorizedException);
 assert.equal(calls.some(call=>call.name==='programReadiness'),false);
});

test('HU-03 API delegates readiness and closure with authenticated company branch and actor',async()=>{
 const{controller,calls}=fixture();
 await controller.programReadiness('Bearer token-1','c1','b9','p1');
 await controller.close('Bearer token-1','c1','b9','p1');
 const expected={companyId:'c1',branchId:'b9',actorId:'user-1'};
 assert.deepEqual(calls.find(call=>call.name==='programReadiness')?.context,expected);
 assert.deepEqual(calls.find(call=>call.name==='closeProgram')?.context,expected);
 assert.equal(calls.find(call=>call.name==='currentUser')?.id,'token-1');
});

test('HU-03 capabilities expose server-side permission results and branch access',async()=>{
 const{controller,calls,denied}=fixture();
 denied.add('hajj_umrah.readiness.close');
 const result=await controller.capabilities('Bearer token','c1','b1');
 assert.equal(result.view,true);assert.equal(result.view360,true);assert.equal(result.reports,true);assert.equal(result.close,false);
 assert.ok(calls.some(call=>call.name==='requireBranchAccess'));
 assert.ok(calls.some(call=>call.name==='authorize'&&call.permission==='hajj_umrah.readiness.close'));
});

test('HU-03 projection endpoints delegate to the canonical readiness application boundary',async()=>{
 const{controller,calls}=fixture();
 await controller.booking360('Bearer token','c1','b1','b1');
 await controller.program360('Bearer token','c1','b1','p1');
 await controller.workQueue('Bearer token','c1','b1','p1');
 await controller.reports('Bearer token','c1','b1','p1');
 await controller.closure('Bearer token','c1','b1','p1');
 for(const name of['booking360','program360','workQueue','reports','evaluateClosure'])assert.ok(calls.some(call=>call.name===name));
});
