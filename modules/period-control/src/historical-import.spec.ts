import assert from 'node:assert/strict';import test from 'node:test';import {HistoricalImportApplicationService,type HistoricalImportRecord}from './application/historical-import.application-service.js';import {PrismaHistoricalImportRepository}from './infrastructure/prisma-historical-import.repository.js';
test('owner historical boundary validates exact decimals, persists once, and never posts economic effects',async()=>{let saved:HistoricalImportRecord|undefined;const service=new HistoricalImportApplicationService({find:async()=>saved,create:async r=>{saved=r},equivalence:async()=>({records:saved?'1':'0',payloadDigest:'digest',debit:saved?.debit??'0',credit:saved?.credit??'0',amount:saved?.amount??'0'})});const input={runId:'run',collection:'history',sourceId:'legacy-1',sourcePayloadHash:'a'.repeat(64),companyId:'company',payload:{id:'legacy-1',amount:'9007199254740993.000000000000000001'}};assert.equal((await service.importHistorical(input)).status,'IMPORTED');assert.equal((await service.importHistorical(input)).status,'CONVERGED');assert.equal((await service.equivalence('run','company')).amount,'9007199254740993.000000000000000001');assert.throws(()=>service.validate({...input,payload:{amount:1}}),/exact decimal string/);});

test('equivalence uses canonical PeriodControl rows and ignores provenance financial values',async()=>{
  const decimal=(v:string)=>({toString:()=>v});
  let periods=[{id:'p-1',companyId:'company',fiscalYearId:'fy-1',startDate:new Date('2026-01-01'),endDate:new Date('2026-01-31'),status:'OPEN'}];
  let provenanceAmount='999';
  const db={
    periodControlHistoricalImport:{findMany:async()=>[
      {collection:'fiscalYears',sourceId:'fy-1',amount:decimal(provenanceAmount),debit:decimal('1'),credit:decimal('1')},
      {collection:'periods',sourceId:'p-1',amount:decimal(provenanceAmount),debit:decimal('2'),credit:decimal('2')},
    ]},
    periodFiscalYear:{findMany:async()=>[{id:'fy-1',companyId:'company',startDate:new Date('2026-01-01'),endDate:new Date('2026-12-31'),status:'OPEN'}]},
    periodAccountingPeriod:{findMany:async()=>periods},
  };
  const repository=new PrismaHistoricalImportRepository(db as never);
  const first=await repository.equivalence('run','company');
  assert.equal(first.records,'2');
  assert.equal(first.amount,'0');
  assert.equal(first.debit,'0');
  assert.equal(first.credit,'0');
  provenanceAmount='123456';
  const provenanceChanged=await repository.equivalence('run','company');
  assert.equal(provenanceChanged.records,'2');
  periods=[];
  const canonicalChanged=await repository.equivalence('run','company');
  assert.equal(canonicalChanged.records,'1');
});
