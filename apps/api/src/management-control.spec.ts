import test from 'node:test';
import assert from 'node:assert/strict';
import { branchId, companyId, executionContext } from '@elhafez/contracts';
import { BadRequestException, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PLATFORM_CORE_PERMISSIONS, PlatformCoreApplicationService } from '@elhafez/platform-core';
import { ManagementControlController, parseWorkCenterFilter } from './management-control.controller.js';
import { ManagementControlService, type ManagementAttentionItem, type ManagementSummary, WorkCenterApplicationService } from './management-control.service.js';

const context=executionContext(companyId('company-1'),branchId('branch-1'),'manager');
const summary:ManagementSummary={crmSales:{customers:0,agents:0,travelers:0,overdueFollowups:0,leadStages:{},quotationStatuses:{},quotationValueByCurrency:[]},suppliers:{total:0,openDisputes:0,activeHolds:0},hajjUmrah:{activePrograms:0,readinessItems:0,criticalReadinessItems:0},finance:{overduePositions:0,overdueByCurrency:[]}};
interface CrmFixture {counts:{customers:number;agents:number;travelers:number;overdueFollowups:number};leadStages:Record<string,number>;quotationStatuses:Record<string,number>;quotationValueByCurrency:{currency:string;total:string}[];attention:{overdueFollowups:{id:string;leadId:string;nextAction:string|null;scheduledAt:string}[];awaitingApproval:{id:string;number:string;updatedAt:string}[];awaitingConversion:{id:string;number:string;updatedAt:string}[]}}
const emptyCrm:CrmFixture={counts:{customers:0,agents:0,travelers:0,overdueFollowups:0},leadStages:{},quotationStatuses:{},quotationValueByCurrency:[],attention:{overdueFollowups:[],awaitingApproval:[],awaitingConversion:[]}};
const emptyAging={positions:[]};

function service(overrides:{crm?:()=>Promise<CrmFixture>;suppliers?:()=>Promise<readonly {party:{id:string}}[]>;supplierOverview?:(id:string)=>Promise<{supplier:{party:{displayName:string}};disputes:{open:readonly {id:string;title:string;severity:string;status:string;openedAt:string}[]};holds:{active:readonly {id:string;reason:string;createdAt:string}[]}}>;programs?:()=>Promise<readonly {id:string;code:string;status:string}[]>;queue?:(id:string)=>Promise<readonly {key:string;priority:'CRITICAL'|'HIGH'|'NORMAL';category:string;title:string;detail:string;dueAt?:string;reference?:{sourceType:string;sourceId:string}}[]>;aging?:()=>Promise<{positions:readonly {evidenceId:string;dueDate?:string;currency:string;openAmount:string}[]}>}={}) {
  return new ManagementControlService(new WorkCenterApplicationService(),{dashboard:overrides.crm??(async()=>emptyCrm)},{searchSuppliers:async()=>overrides.suppliers?.()??[],overview:async(_context,id)=>overrides.supplierOverview?.(id)??Promise.reject(new Error('unexpected supplier'))},{list:async()=>overrides.programs?.()??[]},{workQueue:async(_context,id)=>overrides.queue?.(id)??[]},{aging:async()=>overrides.aging?.()??emptyAging},()=>new Date('2026-09-23T00:00:00.000Z'));
}

test('work center enforces company and branch isolation before filtering',()=>{const work=new WorkCenterApplicationService();const item=(company:string,branch:string,id:string)=>({sourceKey:`FOLLOWUP:${id}`,sourceDomain:'CRM_SALES' as const,sourceType:'FOLLOWUP',sourceId:id,title:id,summary:id,severity:'HIGH' as const,status:'OVERDUE',companyId:company,branchId:branch,occurredAt:'2026-09-20T10:00:00.000Z',category:'FOLLOW_UP',drillDownPath:'/crm/followups'});const result=work.compose('company-1','branch-1',[item('company-1','branch-1','visible'),item('company-2','branch-1','other-company'),item('company-1','branch-2','other-branch')],summary);assert.deepEqual(result.items.map(value=>value.sourceId),['visible']);assert.equal(result.totals.attention,1);});

test('composition preserves CRM KPIs, attention and canonical drill-down',async()=>{const result=await service({crm:async()=>({...emptyCrm,counts:{customers:7,agents:2,travelers:9,overdueFollowups:1},leadStages:{WON:3},quotationStatuses:{ACCEPTED:2},quotationValueByCurrency:[{currency:'EGP',total:'1200'}],attention:{...emptyCrm.attention,overdueFollowups:[{id:'follow-1',leadId:'lead-1',nextAction:'اتصال',scheduledAt:'2026-09-20T00:00:00.000Z'}]}})}).overview(context);assert.equal(result.summary.crmSales.customers,7);assert.deepEqual(result.summary.crmSales.quotationValueByCurrency,[{currency:'EGP',total:'1200'}]);assert.equal(result.items[0]?.sourceKey,'FOLLOWUP:follow-1');assert.equal(result.items[0]?.drillDownPath,'/crm/followups');});

test('composition includes supplier disputes and holds through canonical owner reads',async()=>{const result=await service({suppliers:async()=>[{party:{id:'supplier-1'}}],supplierOverview:async()=>({supplier:{party:{displayName:'مورد'}},disputes:{open:[{id:'dispute-1',title:'جودة',severity:'CRITICAL',status:'OPEN',openedAt:'2026-09-20'}]},holds:{active:[{id:'hold-1',reason:'نزاع حرج',createdAt:'2026-09-21'}]}})}).overview(context);assert.deepEqual(result.summary.suppliers,{total:1,openDisputes:1,activeHolds:1});assert.deepEqual(result.items.map(value=>value.drillDownPath),['/procurement/supplier-intelligence','/procurement/supplier-intelligence']);});

test('composition includes Hajj and Umrah readiness from active programs',async()=>{const result=await service({programs:async()=>[{id:'program-1',code:'UM-1',status:'BOOKABLE'},{id:'closed',code:'UM-0',status:'CLOSED'}],queue:async()=>[{key:'readiness-1',priority:'CRITICAL',category:'CONTROL',title:'مستند ناقص',detail:'MISSING'}]}).overview(context);assert.deepEqual(result.summary.hajjUmrah,{activePrograms:1,readinessItems:1,criticalReadinessItems:1});assert.equal(result.items[0]?.drillDownPath,'/hajj-umrah/readiness');});

test('composition reports overdue financial positions with exact currency totals',async()=>{const result=await service({aging:async()=>({positions:[{evidenceId:'ar-1',dueDate:'2026-09-20',currency:'EGP',openAmount:'10.01'},{evidenceId:'ar-2',dueDate:'2026-09-21',currency:'EGP',openAmount:'2.09'},{evidenceId:'future',dueDate:'2026-10-01',currency:'USD',openAmount:'9'}]})}).overview(context);assert.deepEqual(result.summary.finance,{overduePositions:2,overdueByCurrency:[{currency:'EGP',amount:'12.1'}]});assert.equal(result.items.length,2);});

test('supported filters select status, category and inclusive date boundaries',()=>{const base={sourceDomain:'FINANCE' as const,sourceType:'RECEIVABLE',title:'ذمة',summary:'ذمة',severity:'HIGH' as const,companyId:'company-1',branchId:'branch-1',drillDownPath:'/management/exceptions'};const result=new WorkCenterApplicationService().compose('company-1','branch-1',[{...base,sourceKey:'a',sourceId:'a',status:'OVERDUE',category:'FINANCIAL',occurredAt:'2026-09-20T18:00:00.000Z'},{...base,sourceKey:'b',sourceId:'b',status:'OPEN',category:'CONTROL',occurredAt:'2026-09-21T00:00:00.000Z'}],summary,{domain:'FINANCE',severity:'HIGH',status:'OVERDUE',category:'FINANCIAL',from:'2026-09-20',to:'2026-09-20'});assert.deepEqual(result.items.map(value=>value.sourceId),['a']);});

test('unscoped platform notifications are never requested or surfaced in company management',async()=>{const result=await service().overview(context);assert.equal(result.items.some(value=>value.sourceType==='NOTIFICATION'),false);assert.deepEqual(result.domains.map(value=>value.domain),['CRM_SALES','SUPPLIERS_PROCUREMENT','HAJJ_UMRAH','FINANCE']);});

test('owner failures reject the aggregate instead of becoming successful empty data',async()=>{await assert.rejects(service({crm:async()=>{throw new Error('crm unavailable');}}).overview(context),/crm unavailable/);});

test('Nest runtime DI resolves the controller and enforces branch plus canonical management permission',async()=>{const calls:string[]=[];const management={overview:async()=>new WorkCenterApplicationService().compose('company-1','branch-1',[],summary)};const platform={currentUser:async()=>({id:'manager',email:'m@example.com',status:'ACTIVE',displayName:'Manager',createdAt:new Date(),updatedAt:new Date()}),requireBranchAccess:async()=>{calls.push('branch');},authorize:async(_user:string,_company:string,permission:string)=>{calls.push(permission);}};@Module({controllers:[ManagementControlController],providers:[{provide:ManagementControlService,useValue:management},{provide:PlatformCoreApplicationService,useValue:platform}]})class ManagementControllerTestModule{}const app=await NestFactory.createApplicationContext(ManagementControllerTestModule,{logger:false});try{const controller=app.get(ManagementControlController);await assert.rejects(controller.overview(undefined,'company-1','branch-1',undefined,undefined,undefined,undefined,undefined,undefined),/authenticated company and branch context required/);await controller.overview('Bearer session','company-1','branch-1',undefined,undefined,undefined,undefined,undefined,undefined);assert.deepEqual(calls,['branch',PLATFORM_CORE_PERMISSIONS.managementControlRead]);}finally{await app.close();}});

test('parseWorkCenterFilter rejects unsupported domain', () => {
  assert.throws(() => parseWorkCenterFilter({ domain: 'TREASURY' }), BadRequestException);
});

test('parseWorkCenterFilter rejects unsupported severity', () => {
  assert.throws(() => parseWorkCenterFilter({ severity: 'LOW' }), BadRequestException);
});

test('parseWorkCenterFilter rejects malformed date', () => {
  assert.throws(() => parseWorkCenterFilter({ from: '29/09/2026' }), BadRequestException);
  assert.throws(() => parseWorkCenterFilter({ to: '2026-9-1' }), BadRequestException);
});

test('parseWorkCenterFilter rejects non-existent calendar dates', () => {
  for (const value of ['2026-02-31', '2026-04-31', '2026-13-01', '2026-00-10', '2026-06-00']) {
    assert.throws(() => parseWorkCenterFilter({ from: value }), BadRequestException, value);
  }
  assert.deepEqual(parseWorkCenterFilter({ from: '2028-02-29' }), { from: '2028-02-29' });
});

test('parseWorkCenterFilter rejects from after to', () => {
  assert.throws(() => parseWorkCenterFilter({ from: '2026-09-30', to: '2026-09-01' }), BadRequestException);
});

test('parseWorkCenterFilter trims status/category and drops empty values', () => {
  assert.deepEqual(parseWorkCenterFilter({ status: '  OVERDUE ', category: '   ' }), { status: 'OVERDUE' });
  assert.deepEqual(parseWorkCenterFilter({}), {});
});

test('compose matches status and category case-insensitively', () => {
  const item: ManagementAttentionItem = { sourceKey: 'X:1', sourceDomain: 'CRM_SALES', sourceType: 'X', sourceId: '1', title: 't', summary: 's', severity: 'NORMAL', status: 'Overdue', companyId: context.companyId, branchId: context.branchId, category: 'Follow_Up', drillDownPath: '/x' };
  const workCenter = new WorkCenterApplicationService();
  assert.equal(workCenter.compose(context.companyId, context.branchId, [item], summary, { status: 'OVERDUE' }).items.length, 1);
  assert.equal(workCenter.compose(context.companyId, context.branchId, [item], summary, { category: ' follow_up ' }).items.length, 1);
  assert.equal(workCenter.compose(context.companyId, context.branchId, [item], summary, { status: 'PENDING' }).items.length, 0);
});

test('hajj readiness fallback source keys stay unique across programs sharing the same row.key',async()=>{
  const result=await service({
    programs:async()=>[
      {id:'p1',code:'HAJJ-A',status:'ACTIVE'},
      {id:'p2',code:'HAJJ-B',status:'ACTIVE'},
    ],
    queue:async()=>[
      {key:'VISA_PENDING',priority:'HIGH',category:'VISA',title:'تأشيرات معلقة',detail:'d'},
    ],
  }).overview(context);
  const hajj=result.items.filter(item=>item.sourceDomain==='HAJJ_UMRAH');
  assert.equal(hajj.length,2);
  assert.deepEqual(hajj.map(item=>item.sourceKey).sort(),['READINESS:p1:VISA_PENDING','READINESS:p2:VISA_PENDING']);
  assert.equal(new Set(hajj.map(item=>item.sourceKey)).size,2);
});
