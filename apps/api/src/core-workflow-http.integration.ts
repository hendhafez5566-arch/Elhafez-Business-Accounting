import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CurrencyFxApplicationService } from '@elhafez/currency-fx';
import { GeneralLedgerApplicationService } from '@elhafez/general-ledger';
import { PeriodControlApplicationService } from '@elhafez/period-control';
import { CostBudgetAccountingApplicationService, costCenterId } from '@elhafez/cost-budget-accounting';
import { TreasurySettlementApplicationService } from '@elhafez/treasury-settlement';
import { TourismFinanceOrchestrationApplicationService } from '@elhafez/tourism-finance-orchestration';
import { ExpenseCommissionRecognitionApplicationService } from '@elhafez/expense-commission-recognition';
import { HajjUmrahProgramsApplicationService } from '@elhafez/hajj-umrah-programs';
import { TOURISM_CONTRACT_INVENTORY_SERVICE } from '@elhafez/tourism-contract-inventory/nest';
import type { TourismContractInventoryApplicationService } from '@elhafez/tourism-contract-inventory';
/** Explicit disposable AppModule + PostgreSQL acceptance. Never a production seed. */
import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { spawn } from 'node:child_process';
import { executionContext, companyId, currencyCode, decimalAmount, sourceReference } from '@elhafez/contracts';
import { NestFactory } from '@nestjs/core';
import { TravelerManagementApplicationService } from '@elhafez/traveler-management';
import { PrismaClient } from '@prisma/client';
import { AppModule } from './app.module.js';
import { GlobalRequestSafetyPipe } from './global-request-safety.pipe.js';
import { PlatformErrorFilter } from './platform-error.filter.js';
const databaseUrl=process.env.CORE_TEST_DATABASE_URL;
if(!databaseUrl||databaseUrl!==process.env.DATABASE_URL)throw Error('explicit disposable CORE_TEST_DATABASE_URL required');
const parsed=new URL(databaseUrl);
if(parsed.hostname!=='127.0.0.1'||parsed.pathname!=='/elhafez_core_test')throw Error('refusing non-disposable database');
const filesRoot=mkdtempSync(join(tmpdir(),'elhafez-core-files-'));process.env.ELHAFEZ_FILE_STORAGE_ROOT=filesRoot;
process.env.SAAS_OWNER_BOOTSTRAP_TOKEN=randomBytes(32).toString('hex');
process.env.SAAS_OWNER_MFA_KEY=randomBytes(32).toString('base64url');
const password='Core-test-'+randomBytes(18).toString('hex');
function otp(secret:string){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const c of secret)bits+=alphabet.indexOf(c).toString(2).padStart(5,'0');const key=Buffer.from(Array.from({length:Math.floor(bits.length/8)},(_,i)=>parseInt(bits.slice(i*8,i*8+8),2))),counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const d=createHmac('sha1',key).update(counter).digest(),offset=d[d.length-1]!&15;return((d.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,'0');}
interface Tenant {token:string;userId:string;companyId:string;companyCode:string;defaultBranchId:string;expiresAt:string;branches:Array<{id:string;name:string;active:boolean;companyId:string}>;companyName:string;username:string;subscription:{allowed:boolean;status:string;reason:string|null};}
interface Booking {id:string;financialCustomerId:string;financialPartyId:string;customerId:string;travelerIds:string[];status:string;familyReference:string;}
await test('core workflow actual AppModule and PostgreSQL',async t=>{
 const app=await NestFactory.create(AppModule,{logger:['error','warn']});app.useGlobalPipes(new GlobalRequestSafetyPipe());app.useGlobalFilters(new PlatformErrorFilter());await app.listen(0,'127.0.0.1');const origin=await app.getUrl();
 const db=new PrismaClient();let ownerToken='',mfaSecret='',tenant:Tenant,other:Tenant,booking:Booking,programId='',customerId='',responsibleId='',financialTreasuryId='',attachmentId='';const travelerIds:string[]=[];
 const ownerHeaders=()=>({authorization:'Bearer '+ownerToken,'x-owner-totp':otp(mfaSecret)});
 const headers=(v:Tenant)=>({authorization:'Bearer '+v.token,'x-company-id':v.companyId,'x-branch-id':v.defaultBranchId});
 async function request<T>(path:string,body?:unknown,auth:Record<string,string>={},status=201):Promise<T>{const r=await fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...auth},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});const result:unknown=await r.json();assert.equal(r.status,status,`${path}: ${JSON.stringify(result).slice(0,250)}`);return result as T;}
 async function provision(name:string){const created=await request<{company:{id:string}}>('/saas-owner/companies',{name,administratorUsername:'administrator',temporaryPassword:password,administratorDisplayName:'Test administrator'},ownerHeaders());const plan=await request<{id:string}>('/saas-owner/plans',{code:'CORE-'+randomUUID(),name:'Test plan',intervalMonths:1,priceMinor:100,currency:'EGP',entitlements:['CRM']},ownerHeaders());await request('/saas-owner/companies/'+created.company.id+'/activate',{planId:plan.id,months:1,paymentReference:'test-only',amountMinor:100,currency:'EGP',idempotencyKey:randomUUID()},ownerHeaders());const rows=await request<Array<{company:{id:string};companyCode:string}>>('/saas-owner/companies',undefined,ownerHeaders(),200);const code=rows.find(x=>x.company.id===created.company.id)!.companyCode;const value=await request<Tenant>('/saas/login',{companyCode:code,username:'administrator',password});await request('/saas/credentials/initial-password',{newPassword:'Changed-'+password},headers(value));return value;}
 try{
  await t.test('real owner MFA, local subscription and two isolated companies',async()=>{const boot=await request<{mfaSecret:string}>('/saas-owner/bootstrap',{email:'core-owner@example.test',password},{'x-saas-bootstrap-token':process.env.SAAS_OWNER_BOOTSTRAP_TOKEN!});mfaSecret=boot.mfaSecret;ownerToken=(await request<{token:string}>('/saas-owner/login',{email:'core-owner@example.test',password,mfaCode:otp(mfaSecret)})).token;tenant=await provision('Core Company A');other=await provision('Core Company B');});
  await t.test('family identities and non-traveling debtor persist through real owners',async()=>{
   customerId=(await request<{value:{customer:{id:string}}}>('/crm/customers',{party:{kind:'PERSON',displayName:'المتعاقد التجريبي'}},headers(tenant))).value.customer.id;
   responsibleId=(await request<{value:{customer:{id:string}}}>('/crm/customers',{party:{kind:'PERSON',displayName:'مسؤول أسرة غير مسافر'}},headers(tenant))).value.customer.id;
   const season=await request<{id:string}>('/hajj-umrah/seasons',{code:'CORE-SEASON',arabicName:'موسم تجريبي',operatingStart:'2026-01-01',operatingEnd:'2028-12-31',salesStart:'2026-01-01',salesEnd:'2028-01-01'},headers(tenant));
   const program=await request<{id:string}>('/hajj-umrah/programs',{code:'CORE-PROGRAM',type:'UMRAH',seasonId:season.id,arabicName:'عمرة اختبارية',departureDate:'2027-01-10',returnDate:'2027-01-20',salesStart:'2026-01-01',salesClose:'2027-01-01',capacity:'4',currency:'EGP',prices:{quad:'1000'}},headers(tenant));programId=program.id;
   const travelers=app.get(TravelerManagementApplicationService),context=executionContext(tenant.companyId,tenant.defaultBranchId,tenant.userId);
   for(let index=1;index<=4;index++){const traveler=await travelers.createTraveler(context,{fullName:'مسافر تجريبي '+index,customerId});travelerIds.push(traveler.id);}
   booking=await request<Booking>('/hajj-umrah/operations/bookings',{requestId:randomUUID(),code:'CORE-FAMILY',programId,customerId,financialCustomerId:responsibleId,familyReference:'FAMILY-4',travelerIds},headers(tenant));
   assert.equal(booking.financialCustomerId,responsibleId);assert.equal(booking.customerId,customerId);assert.equal(booking.travelerIds.length,4);assert.equal(booking.status,'PRELIMINARY');
   const saved=await db.hubBooking.findUniqueOrThrow({where:{id:booking.id}});assert.equal(saved.financialCustomerId,responsibleId);assert.equal(saved.familyReference,'FAMILY-4');
  });
  await t.test('twenty concurrent creation retries persist one booking and one creation history',async()=>{const body={requestId:randomUUID(),code:'CORE-RETRY',programId,customerId,financialCustomerId:responsibleId,travelerIds:[travelerIds[0]]};const rows=await Promise.all(Array.from({length:20},()=>request<Booking>('/hajj-umrah/operations/bookings',body,headers(tenant))));assert.equal(new Set(rows.map(x=>x.id)).size,1);assert.equal(await db.hubBookingHistory.count({where:{bookingId:rows[0]!.id,action:'CREATED'}}),1);await request('/hajj-umrah/operations/bookings',{...body,code:'CONFLICT'},headers(tenant),400);});
  await t.test('scoped offline requests reach the real booking owner exactly once',async()=>{const grant=await request<{id:string}>('/offline/delegations',{deviceId:randomUUID(),operations:['BOOKING_CREATE'],durationMinutes:10},headers(tenant));const stored=await db.ocDeviceGrant.findUniqueOrThrow({where:{id:grant.id}});const input={id:randomUUID(),deviceId:stored.deviceId,grantId:grant.id,operation:'BOOKING_CREATE',payload:{code:'CORE-OFFLINE',programId,customerId,financialCustomerId:responsibleId,travelerIds:[travelerIds[0]]},dependencies:[],capturedAt:new Date().toISOString()};const first=await request<{state:string;result:Booking}>('/offline/commands',input,headers(tenant));assert.equal(first.state,'ACCEPTED');const second=await request<{state:string;result:Booking}>('/offline/commands',input,headers(tenant));assert.equal(second.result.id,first.result.id);assert.equal(await db.ocCommand.count({where:{id:input.id}}),1);await request('/offline/commands',{...input,payload:{...input.payload,code:'CHANGED'}},headers(tenant),400);});
  await t.test('expired cash delegation preserves original request for review with zero posted effect',async()=>{const deviceId=randomUUID(),grant=await request<{id:string}>('/offline/delegations',{deviceId,operations:['BOOKING_DEPOSIT'],durationMinutes:1},headers(tenant));const row=await db.ocDeviceGrant.findUniqueOrThrow({where:{id:grant.id}});await db.ocDeviceGrant.update({where:{id:grant.id},data:{issuedAt:new Date(Date.now()-120000),expiresAt:new Date(Date.now()-60000)}});const input={id:randomUUID(),deviceId,grantId:grant.id,operation:'BOOKING_DEPOSIT',payload:{bookingId:booking.id,treasuryId:'test-only',number:'PROVISIONAL-1',postingDate:'2026-10-15',amount:'100'},dependencies:[],capturedAt:row.issuedAt.toISOString()};const result=await request<{state:string;payload:unknown;reason:string}>('/offline/commands',input,headers(tenant));assert.equal(result.state,'REVIEW');assert.deepEqual(result.payload,input.payload);assert.match(result.reason,/expired/);assert.equal(await db.tfoWorkflow.count({where:{commandKey:'offline:'+input.id}}),0);});
  await t.test('company and branch forgery never exposes another family',async()=>{await request('/hajj-umrah/operations/bookings/'+booking.id,undefined,headers(other),400);await request('/offline/commands',undefined,{...headers(tenant),'x-branch-id':other.defaultBranchId},403);});
  await t.test('real booking invoice, split commissions, confirmed receipt and family totals use canonical owners',async()=>{
   const cid=companyId(tenant.companyId),context=executionContext(cid,tenant.defaultBranchId,tenant.userId),fx=app.get(CurrencyFxApplicationService),ledger=app.get(GeneralLedgerApplicationService),periods=app.get(PeriodControlApplicationService),cost=app.get(CostBudgetAccountingApplicationService),treasury=app.get(TreasurySettlementApplicationService),finance=app.get(TourismFinanceOrchestrationApplicationService);
   await fx.configure({companyId:cid,code:currencyCode('EGP'),precision:2,isBase:true,status:'ACTIVE'});
   const year=randomUUID();await periods.createFiscalYear({id:year,companyId:cid,startDate:'2026-01-01',endDate:'2026-12-31',status:'OPEN'});await periods.createPeriod({id:randomUUID(),companyId:cid,fiscalYearId:year,startDate:'2026-01-01',endDate:'2026-12-31',status:'OPEN'});
   const accounts={ar:randomUUID(),advance:randomUUID(),revenue:randomUUID(),cost:randomUUID(),commission:randomUUID(),payable:randomUUID(),cash:randomUUID()};
   for(const [code,id] of Object.entries(accounts))await ledger.createAccount({id,companyId:cid,code:code.toUpperCase(),name:code,classification:code==='revenue'?'REVENUE':code==='advance'||code==='payable'?'LIABILITY':code==='cost'||code==='commission'?'EXPENSE':'ASSET',active:true,postable:true,...(['ar','advance','payable'].includes(code)?{controlType:code==='payable'?'AGENT':'CUSTOMER'}:{})});
   const center=costCenterId(randomUUID());await cost.create({id:center,companyId:cid,code:'CORE',name:'Core acceptance',status:'ACTIVE'});
   const cash=await treasury.createTreasury({id:randomUUID(),companyId:cid,code:'CORE-CASH',name:'Test cash',type:'CASH',currency:'EGP',glAccountId:accounts.cash});
   financialTreasuryId=cash.id;
   await finance.configureFinancialSetup({id:randomUUID(),companyId:cid,category:'HOTEL',receivableAccountId:accounts.ar,customerAdvanceAccountId:accounts.advance,revenueAccountId:accounts.revenue,costAccountId:accounts.cost,commissionExpenseAccountId:accounts.commission,commissionLiabilityAccountId:accounts.payable,active:true});
   const inventory=app.get<TourismContractInventoryApplicationService>(TOURISM_CONTRACT_INVENTORY_SERVICE),contract=await inventory.createContract({companyId:cid,type:'HOTEL',effectiveFrom:'2026-01-01',effectiveTo:'2028-01-01'}),hotel=await inventory.createHotelInventory({companyId:cid,contractId:contract.id,hotelId:'TEST-HOTEL',serviceDate:'2027-01-10',contractedQuantity:decimalAmount('4')});
   const parent=(await request<{value:{agent:{id:string}}}>('/crm/agents',{party:{kind:'PERSON',displayName:'Finance principal'},commission:{kind:'PERCENT',value:'5',currency:null}},headers(tenant))).value.agent.id;
   const child=(await request<{value:{agent:{id:string}}}>('/crm/agents',{party:{kind:'PERSON',displayName:'Finance subordinate'},commission:{kind:'PERCENT',value:'5',currency:null}},headers(tenant))).value.agent.id;
   await request('/crm/agents/'+child+'/parent',{parentAgentId:parent},headers(tenant));await request('/crm/agents/'+child+'/commission-agreements',{requestId:randomUUID(),parentAgentId:parent,expectedVersion:0,principalPercent:'33.333333',reason:'Test signed agreement'},headers(tenant));
   const financialBooking=await request<Booking>('/hajj-umrah/operations/bookings',{code:'CORE-FINANCIAL',programId,customerId,financialCustomerId:responsibleId,familyReference:'FAMILY-4',travelerIds,agentId:child},headers(tenant));
   const programs=app.get(HajjUmrahProgramsApplicationService),prepared=await programs.get(context,programId);await programs.editPreparing(context,programId,{code:prepared.code,type:prepared.type,seasonId:prepared.seasonId,arabicName:prepared.arabicName,...prepared.snapshot,requirements:['HOTEL'],components:[{type:'HOTEL',title:'Test contracted hotel',sequence:1,inventoryReference:hotel.id,start:'2027-01-10'}]});await programs.openForBooking(context,programId);
   const confirmed=await request<{financialEvidence:{invoiceId:string;commissionClaimIds:string[]}}>('/hajj-umrah/operations/bookings/'+financialBooking.id+'/confirm',{commandKey:'core-confirm',category:'HOTEL',costCenterId:center,currency:'EGP',grossAmount:'4000',discountAmount:'0',postingDate:'2026-10-15',dueDate:'2026-12-01',invoiceNumber:'CORE-INVOICE',inventories:[{allocationId:'core-allocation',contractId:contract.id,resourceType:'HOTEL',resourceId:hotel.id,serviceDate:'2027-01-10',quantity:'4'}],commissionAmount:'100.01'},headers(tenant));
   assert.equal(confirmed.financialEvidence.commissionClaimIds.length,2);
   const claims=await db.ecrCommissionClaim.findMany({where:{id:{in:confirmed.financialEvidence.commissionClaimIds}},orderBy:{amount:'asc'}});assert.deepEqual(claims.map(x=>x.amount.toString()),['33.33','66.68']);
   const ecr=app.get(ExpenseCommissionRecognitionApplicationService);for(const claim of claims)await ecr.approveCommission(cid,claim.id,'2026-10-15','CORE-COMMISSION-'+claim.id);
   const deposit={companyId:cid,branchId:tenant.defaultBranchId,commandKey:'core-deposit',booking:sourceReference('HAJJ_UMRAH_BOOKING',financialBooking.id),treasuryId:cash.id,number:'CORE-RECEIPT',postingDate:'2026-10-15',amount:decimalAmount('2500')};await finance.recordBookingDeposit(deposit);await finance.recordBookingDeposit(deposit);
   const statement=await request<{rows:Array<{allocationBasis:string}>;totals:Array<{currency:string;charged:string;paid:string;outstanding:string}>}>('/hajj-umrah/family-statement?reference=FAMILY-4',undefined,headers(tenant),200);assert.deepEqual(statement.totals,[{currency:'EGP',charged:'4000',paid:'2500',outstanding:'1500'}]);assert.ok(statement.rows.every(x=>x.allocationBasis==='SHARED_NOT_DISTRIBUTED'));assert.ok(!JSON.stringify(statement).includes('commission'));
   const concurrent=[{...deposit,commandKey:'concurrent-cash-a',number:'CONCURRENT-A',amount:decimalAmount('10')},{...deposit,commandKey:'concurrent-cash-b',number:'CONCURRENT-B',amount:decimalAmount('20')}];
   const outcomes=await Promise.allSettled(concurrent.map(input=>finance.recordBookingDeposit(input)));
   for(const [index,outcome] of outcomes.entries())if(outcome.status==='rejected')await finance.recordBookingDeposit(concurrent[index]!);
   const reference=await db.tfoBookingReference.findFirstOrThrow({where:{companyId:cid,bookingId:financialBooking.id}});
   assert.equal((reference.depositVoucherIds as string[]).length,3,'distinct concurrent receipts must all remain available for cancellation/recovery');
   const updated=await request<{totals:Array<{outstanding:string}>}>('/hajj-umrah/family-statement?reference=FAMILY-4',undefined,headers(tenant),200);assert.equal(updated.totals[0]?.outstanding,'1470');

  });
  if(process.env.CORE_BROWSER_PACKAGE){await t.test('production browser saves encrypted offline request and synchronizes through actual AppModule',async()=>{
   await new Promise<void>((resolve,reject)=>{const child=spawn(process.execPath,['tools/experiments/core-workflow/browser.mjs'],{env:{...process.env,CORE_API_ORIGIN:origin},stdio:['pipe','pipe','pipe']});let output='';child.stdout.on('data',chunk=>output+=String(chunk));child.stderr.on('data',chunk=>output+=String(chunk));child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('browser acceptance failed: '+output.slice(-2000))));child.stdin.end(JSON.stringify({tenant:{...tenant,mustChangePassword:false},programId,customerId,responsibleId,travelerIds,financialTreasuryId}));});
  });}
  await t.test('real attachment and dependency-pending command are retained for clean recovery',async()=>{
   const content=Buffer.from('Independent core acceptance attachment / مرفق تجريبي','utf8');
   const link=await request<{fileId:string}>('/crm/customers/'+customerId+'/files',{label:'Test attachment',contentType:'text/plain',contentBase64:content.toString('base64')},headers(tenant));
   const read=await request<{contentBase64:string}>('/crm/customers/'+customerId+'/files/'+link.fileId,undefined,headers(tenant),200);assert.deepEqual(Buffer.from(read.contentBase64,'base64'),content);
   const deviceId=randomUUID(),grant=await request<{id:string}>('/offline/delegations',{deviceId,operations:['BOOKING_CREATE'],durationMinutes:10},headers(tenant));
   const pending=await request<{state:string}>('/offline/commands',{id:randomUUID(),deviceId,grantId:grant.id,operation:'BOOKING_CREATE',payload:{code:'RECOVERY-PENDING',programId,customerId,travelerIds:[travelerIds[0]]},dependencies:[randomUUID()],capturedAt:new Date().toISOString()},headers(tenant));assert.equal(pending.state,'PENDING');
   attachmentId=link.fileId;
   const file=await db.pcFile.findUniqueOrThrow({where:{id:link.fileId}});writeFileSync('/tmp/core-recovery-manifest.json',JSON.stringify({filesRoot,files:[{storageKey:file.storageKey,checksum:file.checksum}]}),{mode:0o600});
  });
  await t.test('enrolled office fences cloud or missing server identity without automatic promotion',async()=>{
   process.env.ELHAFEZ_WRITE_AUTHORITY_ID='office-test-000000000001';
   await request('/offline/authority/enroll',{},headers(tenant));
   process.env.ELHAFEZ_WRITE_AUTHORITY_ID='cloud-test-000000000001';
   await request('/offline/delegations',{deviceId:randomUUID(),operations:['BOOKING_CREATE'],durationMinutes:10},headers(tenant),403);
   await request('/offline/authority/enroll',{},headers(tenant),400);
   delete process.env.ELHAFEZ_WRITE_AUTHORITY_ID;
   await request('/offline/delegations',{deviceId:randomUUID(),operations:['BOOKING_CREATE'],durationMinutes:10},headers(tenant),403);
   process.env.ELHAFEZ_WRITE_AUTHORITY_ID='office-test-000000000001';
   await request('/offline/delegations',{deviceId:randomUUID(),operations:['BOOKING_CREATE'],durationMinutes:10},headers(tenant));
  });
  await t.test('cold local API and static process authenticate against retained PostgreSQL',async()=>{
   const child=spawn('bash',['deploy/local/start.sh'],{env:{...process.env,ELHAFEZ_API_PORT:'54879',ELHAFEZ_WEB_PORT:'54880'},stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',x=>output+=String(x));child.stderr.on('data',x=>output+=String(x));
   try{let ready=false;for(let attempt=0;attempt<60;attempt++){try{const response=await fetch('http://127.0.0.1:54880/api/health',{signal:AbortSignal.timeout(1000)});if(response.ok){ready=true;break;}}catch(error){if(child.exitCode!==null)throw Error('local process exited: '+output.slice(-1500),{cause:error});}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,'cold local processes failed readiness');
    const response=await fetch('http://127.0.0.1:54880/api/saas/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({companyCode:tenant.companyCode,username:'administrator',password:'Changed-'+password})});assert.equal(response.status,201);const login=await response.json() as {userId:string};assert.equal(login.userId,tenant.userId);
    assert.equal((await fetch('http://127.0.0.1:54880/hajj-umrah/bookings')).status,200);
   }finally{child.kill('SIGTERM');await new Promise<void>(resolve=>child.once('exit',()=>resolve()));}
  });
  if(process.env.CORE_LAN_IMAGE){await t.test('cold network-isolated LAN uses local login, subscription, files and the same owners',async()=>{
   await new Promise<void>((resolve,reject)=>{const child=spawn(process.execPath,['tools/experiments/core-workflow/lan-isolation.mjs'],{env:process.env,stdio:['pipe','pipe','pipe']});let output='';child.stdout.on('data',x=>output+=String(x));child.stderr.on('data',x=>output+=String(x));child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(output.slice(-2000))));child.stdin.end(JSON.stringify({filesRoot,customerId,fileId:attachmentId,companyCode:tenant.companyCode,password:'Changed-'+password,userId:tenant.userId}));});
  });}
 }finally{await db.$disconnect();await app.close();}
});
