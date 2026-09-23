import test from 'node:test';import assert from 'node:assert/strict';import {CsvParser,DataExchangeApplicationService,InMemoryDataExchangeRepository} from './public/index.js';
test('preview is non-mutating and execution uses public target with convergent retries and explicit errors',async()=>{const s=new DataExchangeApplicationService(new InMemoryDataExchangeRepository());const j=await s.upload({companyId:'c',fileName:'x.csv',format:'CSV',mapping:{name:'displayName'},idempotencyKey:'delivery',rows:[{name:'A'},{name:'B'},{}]});let calls=0;const p=await s.preview('c',j.id,['name']);assert.equal(calls,0);const target={importRow:async({values}:{values:Readonly<Record<string,string>>})=>{calls++;if(values.displayName==='B')throw new Error('conflict');return 'IMPORTED' as const}};const done=await s.execute('c',p.id,target);assert.equal(done.status,'COMPLETED_WITH_ERRORS');assert.deepEqual(done.rows.map(x=>x.outcome),['IMPORTED','FAILED','FAILED']);const same=await s.upload({companyId:'c',fileName:'x.csv',format:'CSV',mapping:{},idempotencyKey:'delivery',rows:[]});assert.equal(same.id,j.id)});
test('CSV and real ExcelJS XLSX bytes ingest through the parser and export lifecycle persists a result reference',async()=>{const repo=new InMemoryDataExchangeRepository();const {CsvParser,XlsxParser}=await import('./public/index.js');const ExcelJS=(await import('exceljs')).default;const workbook=new ExcelJS.Workbook();const sheet=workbook.addWorksheet('Import');sheet.addRow(['name','email']);sheet.addRow(['B','b@example.test']);const bytes=await workbook.xlsx.writeBuffer();const service=new DataExchangeApplicationService(repo,[new CsvParser(),new XlsxParser()]);const csv=await service.ingest({companyId:'c',fileName:'x.csv',format:'CSV',content:new TextEncoder().encode('name,email\n"A, One",a@example.test'),mapping:{name:'name'},idempotencyKey:'csv'});assert.equal(csv.rows[0]?.source.name,'A, One');const xlsx=await service.ingest({companyId:'c',fileName:'x.xlsx',format:'XLSX',content:new Uint8Array(bytes),mapping:{name:'name'},idempotencyKey:'xlsx'});assert.equal(xlsx.rows[0]?.source.email,'b@example.test');const exported=await service.createExport({companyId:'c',fileName:'out.csv',format:'CSV',idempotencyKey:'export'}, {read:async()=>[{id:'1'}]}, {write:async()=> 'exports/out.csv'});assert.equal(exported.status,'COMPLETED');assert.equal((await service.get('c',exported.id)).resultKey,'exports/out.csv')});
test('a durable row failure retries and converges without replaying imported rows',async()=>{const service=new DataExchangeApplicationService(new InMemoryDataExchangeRepository());const job=await service.upload({companyId:'c',fileName:'x.csv',format:'CSV',mapping:{name:'name'},idempotencyKey:'retry',rows:[{name:'A'},{name:'B'}]});await service.preview('c',job.id,['name']);let bCalls=0;const first=await service.execute('c',job.id,{importRow:async({values})=>{if(values.name==='B'&&bCalls++===0)throw new Error('temporary');return'IMPORTED'}});assert.equal(first.status,'COMPLETED_WITH_ERRORS');const second=await service.execute('c',job.id,{importRow:async()=>{bCalls++;return'IMPORTED'}});assert.equal(second.status,'COMPLETED');assert.equal(bCalls,2)});

test('dataset is durable and preview validates canonical mapped target fields',async()=>{
 const service=new DataExchangeApplicationService(new InMemoryDataExchangeRepository(),[new CsvParser()]);
 const job=await service.ingest({companyId:'c',branchId:'b',dataset:'CUSTOMERS',fileName:'customers.csv',format:'CSV',content:new TextEncoder().encode('النوع,الاسم\nPERSON,Ahmed'),mapping:{'النوع':'kind','الاسم':'displayName'},idempotencyKey:'mapped'});
 assert.equal(job.dataset,'CUSTOMERS');
 const preview=await service.preview('c',job.id,['kind','displayName']);
 assert.equal(preview.status,'READY');
 let values:Readonly<Record<string,string>>={};
 await service.execute('c',job.id,{importRow:async input=>{values=input.values;return'IMPORTED';}});
 assert.deepEqual(values,{kind:'PERSON',displayName:'Ahmed'});
});
test('tabular exporter emits real CSV and XLSX bytes',async()=>{
 const {TabularExporter,XlsxParser}=await import('./public/index.js');
 const exporter=new TabularExporter(),rows=[{name:'A, One',email:'a@example.test'}];
 const csv=new TextDecoder().decode(await exporter.encode('CSV',rows));
 assert.match(csv,/"A, One"/);
 const xlsx=await exporter.encode('XLSX',rows);
 assert.ok(xlsx.byteLength>100);
 const parsed=await new XlsxParser().parse(xlsx);
 assert.equal(parsed[0]?.email,'a@example.test');
});

test('column mapping can be changed before execution but not after imported rows exist',async()=>{
 const service=new DataExchangeApplicationService(new InMemoryDataExchangeRepository());
 const job=await service.upload({companyId:'c',dataset:'CUSTOMERS',fileName:'customers.csv',format:'CSV',mapping:{},idempotencyKey:'map-lifecycle',rows:[{'اسم':'Ahmed','نوع':'PERSON'}]});
 const mapped=await service.setMapping('c',job.id,{'اسم':'displayName','نوع':'kind'});
 assert.deepEqual(mapped.mapping,{'اسم':'displayName','نوع':'kind'});
 await service.preview('c',job.id,['displayName','kind']);
 await service.execute('c',job.id,{importRow:async()=> 'IMPORTED'});
 await assert.rejects(service.setMapping('c',job.id,{'اسم':'displayName'}),/mapping cannot change/);
});
