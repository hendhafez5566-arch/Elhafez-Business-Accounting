import test from 'node:test';
import assert from 'node:assert/strict';
import {ContractValidationError,executionContext} from '@elhafez/contracts';
import type {StandaloneServicesApplicationService} from '@elhafez/standalone-services';
import type {CustomerManagementApplicationService} from '@elhafez/customer-management';
import type {SupplierManagementApplicationService} from '@elhafez/supplier-management';
import type {PlatformCoreApplicationService} from '@elhafez/platform-core';
import {SystemAdministrationDataExchangeBoundary,SystemAdministrationExchangeError} from './system-administration-data-exchange.js';

test('system administration data exchange exposes only explicit supported datasets',()=>{
 const boundary=new SystemAdministrationDataExchangeBoundary({} as Pick<CustomerManagementApplicationService,'create'|'list'>,{} as Pick<SupplierManagementApplicationService,'create'|'list'>,{} as Pick<PlatformCoreApplicationService,'uploadFile'|'getFile'|'authorize'>);
 assert.deepEqual(boundary.datasets().map(value=>value.id),['CUSTOMERS','SUPPLIERS','SERVICES']);
 assert.equal(boundary.requireDataset('customers'),'CUSTOMERS');
 assert.throws(()=>boundary.requireDataset('arbitrary_table'),SystemAdministrationExchangeError);
});

test('customer import enters the owning customer public API and preserves company/branch scope',async()=>{
 let receivedName='';
 const customers={
  create:async (_context:ReturnType<typeof executionContext>,input:{party:{displayName:string}})=>{receivedName=input.party.displayName;return{status:'EXISTING'} as const;},
  list:async()=>[]
 } as unknown as Pick<CustomerManagementApplicationService,'create'|'list'>;
 const boundary=new SystemAdministrationDataExchangeBoundary(customers,{} as Pick<SupplierManagementApplicationService,'create'|'list'>,{} as Pick<PlatformCoreApplicationService,'uploadFile'|'getFile'|'authorize'>);
 const context=executionContext('company-a','branch-a','actor-a');
 const target=boundary.importTarget('CUSTOMERS',context);
 assert.equal(await target.importRow({companyId:'company-a',branchId:'branch-a',values:{kind:'PERSON',displayName:'Ahmed'},idempotencyKey:'row-1'}),'DUPLICATE');
 assert.equal(receivedName,'Ahmed');
 await assert.rejects(target.importRow({companyId:'company-b',branchId:'branch-a',values:{kind:'PERSON',displayName:'X'},idempotencyKey:'row-2'}),SystemAdministrationExchangeError);
});

test('export uses owning source and trusted platform file storage without exposing a storage key',async()=>{
 const customers={
  create:async()=>{throw new Error('unused');},
  list:async()=>[{customer:{id:'c1',companyId:'company-a',partyId:'p1',number:'CUS-000001',status:'ACTIVE',assignedAgentId:null,commercialNotes:null,createdAt:'',updatedAt:''},party:{id:'p1',companyId:'company-a',kind:'PERSON',displayName:'Ahmed',legalName:null,phone:null,phoneNormalized:null,whatsappNumber:null,whatsappNormalized:null,email:'a@example.test',emailNormalized:'a@example.test',address:null,nationalIdentity:null,nationalIdentityNormalized:null,taxIdentity:null,taxIdentityNormalized:null,status:'ACTIVE',createdAt:'',updatedAt:''}}]
 } as unknown as Pick<CustomerManagementApplicationService,'create'|'list'>;
 let storedBytes=0;
 const files={
  uploadFile:async(input:{content:Uint8Array})=>{storedBytes=input.content.byteLength;return{id:'file-1'};},
  getFile:async()=>{throw new Error('unused');}
 } as unknown as Pick<PlatformCoreApplicationService,'uploadFile'|'getFile'|'authorize'>;
 const boundary=new SystemAdministrationDataExchangeBoundary(customers,{} as Pick<SupplierManagementApplicationService,'create'|'list'>,files);
 const context=executionContext('company-a','branch-a','actor-a');
 const rows=await boundary.exportSource('CUSTOMERS',context).read({companyId:'company-a',branchId:'branch-a'});
 assert.equal(rows[0]?.displayName,'Ahmed');
 const fileId=await boundary.exportStorage(context).write({jobId:'j1',format:'CSV',rows});
 assert.equal(fileId,'file-1');
 assert.ok(storedBytes>0);
});

test('services CSV import creates only scoped drafts, retries safely, and quarantines confirmed history',async()=>{
 const authorized:string[]=[],created:{id:string;number:string;branchId:string}[]=[];
 const files={authorize:async(_actor:string,_company:string,permission:string)=>{authorized.push(permission)}} as unknown as Pick<PlatformCoreApplicationService,'uploadFile'|'getFile'|'authorize'>;
 const services={getService:async()=>{throw new ContractValidationError('serviceId','not found')},createDraft:async(input:{id:string;number:string;branchId:string})=>{created.push(input);return input},listServices:async()=>[]} as unknown as StandaloneServicesApplicationService;
 const boundary=new SystemAdministrationDataExchangeBoundary({} as CustomerManagementApplicationService,{} as SupplierManagementApplicationService,files,services);
 const context=executionContext('company-a','branch-a','actor-a'),target=boundary.importTarget('SERVICES',context);
 const values={sourceId:'legacy-1',status:'DRAFT',number:'S-100',serviceTypeId:'hotel',serviceDate:'2026-10-01',quantity:'2',customerPartyId:'customer-1',currency:'EGP',grossAmount:'50'};
 assert.equal(await target.importRow({companyId:'company-a',branchId:'branch-a',values,idempotencyKey:'job-1:1'}),'IMPORTED');
 assert.equal(created[0]?.branchId,'branch-a');assert.ok(authorized.includes('tourism.services.manage'));
 await assert.rejects(target.importRow({companyId:'company-a',branchId:'branch-a',values:{...values,status:'CONFIRMED'},idempotencyKey:'job-1:2'}),/requires financial and supply reconciliation/);
 await assert.rejects(target.importRow({companyId:'company-a',branchId:'branch-b',values,idempotencyKey:'job-1:3'}),/scope mismatch/);
});
