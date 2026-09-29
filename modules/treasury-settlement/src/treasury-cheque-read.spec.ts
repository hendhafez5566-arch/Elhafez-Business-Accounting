import test from'node:test';
import assert from'node:assert/strict';
import{companyId}from'@elhafez/contracts';
import{TreasuryChequeReadApplicationService}from'./application/treasury-cheque-read.application-service.js';

test('treasury cheque read stays company-scoped and orders due dates deterministically',async()=>{
 const seen:string[]=[];
 const service=new TreasuryChequeReadApplicationService({list:async company=>{seen.push(company);return[
  {id:'later',companyId:company,voucherId:'v2',direction:'OUTGOING',number:'2',amount:'20',currency:'EGP',issueDate:'2026-09-01',dueDate:'2026-10-02',status:'ISSUED',history:[]},
  {id:'soon',companyId:company,voucherId:'v1',direction:'INCOMING',number:'1',amount:'10',currency:'EGP',issueDate:'2026-09-01',dueDate:'2026-09-30',status:'ISSUED',history:[]},
 ] as never[];}});
 const rows=await service.list(companyId('company-a'));
 assert.deepEqual(seen,['company-a']);
 assert.deepEqual(rows.map(row=>row.id),['soon','later']);
});
