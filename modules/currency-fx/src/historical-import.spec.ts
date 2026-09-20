import assert from 'node:assert/strict';import test from 'node:test';import {HistoricalImportApplicationService,type HistoricalImportRecord}from './application/historical-import.application-service.js';import {PrismaHistoricalImportRepository}from './infrastructure/prisma-historical-import.repository.js';
test('owner historical boundary validates exact decimals, persists once, and never posts economic effects',async()=>{let saved:HistoricalImportRecord|undefined;const service=new HistoricalImportApplicationService({find:async()=>saved,create:async r=>{saved=r},equivalence:async()=>({records:saved?'1':'0',payloadDigest:'digest',debit:saved?.debit??'0',credit:saved?.credit??'0',amount:saved?.amount??'0'})});const input={runId:'run',collection:'history',sourceId:'legacy-1',sourcePayloadHash:'a'.repeat(64),companyId:'company',payload:{id:'legacy-1',amount:'9007199254740993.000000000000000001'}};assert.equal((await service.importHistorical(input)).status,'IMPORTED');assert.equal((await service.importHistorical(input)).status,'CONVERGED');assert.equal((await service.equivalence('run','company')).amount,'9007199254740993.000000000000000001');assert.throws(()=>service.validate({...input,payload:{amount:1}}),/exact decimal string/);});

test('equivalence follows canonical CurrencyFx rows and ignores provenance money values',async()=>{
  let currencyRows=[{companyId:'company',code:'USD',precision:2,isBase:true,status:'ACTIVE'}];
  const decimal=(v:string)=>({toString:()=>v,constructor:{name:'Decimal'}});
  let provenanceAmount='999';
  const db={
    currencyFxHistoricalImport:{findMany:async()=>[
      {collection:'currencies',sourceId:'USD',payload:{code:'USD'},amount:decimal(provenanceAmount),debit:decimal('5'),credit:decimal('5')},
    ]},
    fxCurrency:{findMany:async()=>currencyRows},
    fxRate:{findMany:async()=>[]},
  };
  const repository=new PrismaHistoricalImportRepository(db as never);
  const first=await repository.equivalence('run','company');
  assert.equal(first.records,'1');
  assert.equal(first.amount,'0');
  assert.equal(first.debit,'0');
  assert.equal(first.credit,'0');
  provenanceAmount='123456';
  const provenanceChanged=await repository.equivalence('run','company');
  assert.equal(provenanceChanged.amount,'0');
  assert.equal(provenanceChanged.records,'1');
  currencyRows=[
    {companyId:'company',code:'USD',precision:2,isBase:true,status:'ACTIVE'},
    {companyId:'company',code:'EUR',precision:2,isBase:false,status:'ACTIVE'},
  ];
  const canonicalChanged=await repository.equivalence('run','company');
  assert.equal(canonicalChanged.records,'2');
});
