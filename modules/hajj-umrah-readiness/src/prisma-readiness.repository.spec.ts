import assert from'node:assert/strict';
import test from'node:test';
import{PrismaReadinessRepository}from'./infrastructure/prisma-readiness.repository.js';

test('Prisma closure CAS rejects stale intermediate writers and preserves terminal COMPLETED evidence',async()=>{
 let row={
  id:'e1',companyId:'c1',branchId:'b1',programId:'p1',programUpdatedAt:new Date('2027-04-01T00:00:00.000Z'),
  commandKey:'close-1',evidenceHash:'hash-1',evidence:{stage:'prepared'},financialEvidence:null as unknown|null,
  status:'PREPARED',revision:0,createdAt:new Date('2027-04-20T10:00:00.000Z'),updatedAt:new Date('2027-04-20T10:00:00.000Z'),completedAt:null as Date|null,
 };
 type UpdateInput={where:{id:string;status:string;revision:number};data:{status?:string;revision?:{increment:number};updatedAt?:Date;evidenceHash?:string;evidence?:unknown;financialEvidence?:unknown;completedAt?:Date}};
 const db={hureClosureEvidence:{
  async updateMany(input:UpdateInput){
   if(row.id!==input.where.id||row.status!==input.where.status||row.revision!==input.where.revision)return{count:0};
   row={...row,
    ...(input.data.status?{status:input.data.status}:{}),
    revision:row.revision+(input.data.revision?.increment??0),
    ...(input.data.updatedAt?{updatedAt:input.data.updatedAt}:{}),
    ...(input.data.evidenceHash?{evidenceHash:input.data.evidenceHash}:{}),
    ...(input.data.evidence!==undefined?{evidence:input.data.evidence}:{}),
    ...(input.data.financialEvidence!==undefined?{financialEvidence:input.data.financialEvidence}:{}),
    ...(input.data.completedAt?{completedAt:input.data.completedAt}:{}),
   };
   return{count:1};
  },
  async findUnique(input:{where:{id:string}}){return input.where.id===row.id?row:null},
 }};
 const repo=new PrismaReadinessRepository(db as never);
 const owner=await repo.advance('e1','PREPARED',0,{status:'OWNER_CLOSED',updatedAt:'2027-04-20T10:01:00.000Z'});
 assert.equal(owner.status,'OWNER_CLOSED');assert.equal(owner.revision,1);
 const finance=await repo.advance('e1','OWNER_CLOSED',1,{status:'FINANCE_CONFIRMED',updatedAt:'2027-04-20T10:02:00.000Z',financialEvidence:{workflowId:'wf-1'}});
 assert.equal(finance.status,'FINANCE_CONFIRMED');assert.equal(finance.revision,2);
 const completedAt='2027-04-20T10:03:00.000Z';
 const completed=await repo.advance('e1','FINANCE_CONFIRMED',2,{status:'COMPLETED',updatedAt:completedAt,completedAt});
 assert.equal(completed.status,'COMPLETED');assert.equal(completed.revision,3);assert.equal(completed.completedAt,completedAt);
 const stale=await repo.advance('e1','OWNER_CLOSED',1,{status:'FINANCE_CONFIRMED',updatedAt:'2027-04-20T10:04:00.000Z',financialEvidence:{workflowId:'stale'}});
 assert.equal(stale.status,'COMPLETED');assert.equal(stale.revision,3);assert.equal(stale.completedAt,completedAt);
 assert.deepEqual(stale.financialEvidence,{workflowId:'wf-1'});
});
