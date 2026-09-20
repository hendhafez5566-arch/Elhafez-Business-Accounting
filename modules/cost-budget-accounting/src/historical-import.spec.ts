import assert from 'node:assert/strict';import test from 'node:test';import {HistoricalImportApplicationService,type HistoricalImportRecord}from './application/historical-import.application-service.js';import {PrismaHistoricalImportRepository}from './infrastructure/prisma-historical-import.repository.js';
test('owner historical boundary validates exact decimals, persists once, and never posts economic effects',async()=>{let saved:HistoricalImportRecord|undefined;const service=new HistoricalImportApplicationService({find:async()=>saved,create:async r=>{saved=r},equivalence:async()=>({records:saved?'1':'0',payloadDigest:'digest',debit:saved?.debit??'0',credit:saved?.credit??'0',amount:saved?.amount??'0'})});const input={runId:'run',collection:'history',sourceId:'legacy-1',sourcePayloadHash:'a'.repeat(64),companyId:'company',payload:{id:'legacy-1',amount:'9007199254740993.000000000000000001'}};assert.equal((await service.importHistorical(input)).status,'IMPORTED');assert.equal((await service.importHistorical(input)).status,'CONVERGED');assert.equal((await service.equivalence('run','company')).amount,'9007199254740993.000000000000000001');assert.throws(()=>service.validate({...input,payload:{amount:1}}),/exact decimal string/);});

test('equivalence uses canonical CostBudget values and provenance only for run membership',async()=>{
  const decimal=(v:string)=>({toString:()=>v,constructor:{name:'Decimal'}});
  let canonicalBudget='75';
  let provenanceAmount='999';
  const db={
    costBudgetAccountingHistoricalImport:{findMany:async()=>[
      {collection:'costCenters',sourceId:'cc-1',amount:decimal(provenanceAmount),debit:decimal('10'),credit:decimal('10')},
      {collection:'budgets',sourceId:'b-1',amount:decimal(provenanceAmount),debit:decimal('20'),credit:decimal('20')},
    ]},
    cbaCostCenter:{findMany:async()=>[{id:'cc-1',companyId:'company',code:'CC',name:'CC',status:'ACTIVE',parentId:null}]},
    cbaBudget:{findMany:async()=>[{id:'b-1',companyId:'company',costCenterId:'cc-1',periodStart:new Date('2026-01-01'),periodEnd:new Date('2026-12-31'),currency:'EGP',amount:decimal(canonicalBudget),status:'ACTIVE',requestHash:'x'}]},
  };
  const repository=new PrismaHistoricalImportRepository(db as never);
  const first=await repository.equivalence('run','company');
  assert.equal(first.records,'2');
  assert.equal(first.amount,'75');
  assert.equal(first.debit,'0');
  assert.equal(first.credit,'0');
  provenanceAmount='123456';
  const provenanceChanged=await repository.equivalence('run','company');
  assert.equal(provenanceChanged.amount,'75');
  canonicalBudget='125';
  const canonicalChanged=await repository.equivalence('run','company');
  assert.equal(canonicalChanged.amount,'125');
});
