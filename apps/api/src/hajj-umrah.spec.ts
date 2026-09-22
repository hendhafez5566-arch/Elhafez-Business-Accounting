import assert from'node:assert/strict';
import test from'node:test';
import{BadRequestException}from'@nestjs/common';
import{HajjUmrahController}from'./hajj-umrah.controller.js';

function fixture(blocked=false){
 const calls:string[]=[];
 const programs={async recordReturn(){calls.push('programs.recordReturn');return{id:'p1'}}};
 const readiness={async closeProgram(context:{companyId:string;branchId:string;actorId:string},id:string){calls.push(`readiness.close:${context.companyId}:${context.branchId}:${context.actorId}:${id}`);return blocked?{closed:false,program:{id,status:'IN_TRIP'},blockers:[{code:'OPEN_TASK'}]}:{closed:true,program:{id,status:'CLOSED'},blockers:[]}}};
 const platform={async currentUser(){return{id:'u1'}},async requireBranchAccess(){return undefined},async authorize(){return undefined}};
 return{controller:new HajjUmrahController({}as never,programs as never,readiness as never,platform as never),calls};
}

test('legacy return API delegates to HU-03 closure orchestration instead of direct program closure',async()=>{
 const{controller,calls}=fixture(false);
 const result=await controller.returned('Bearer token','c1','b1','p1');
 assert.equal(result.status,'CLOSED');
 assert.ok(calls.includes('readiness.close:c1:b1:u1:p1'));
 assert.equal(calls.includes('programs.recordReturn'),false);
});

test('blocked HU-03 closure leaves legacy return API blocked and never invokes direct owner return',async()=>{
 const{controller,calls}=fixture(true);
 await assert.rejects(()=>controller.returned('Bearer token','c1','b1','p1'),error=>error instanceof BadRequestException);
 assert.equal(calls.includes('programs.recordReturn'),false);
});
