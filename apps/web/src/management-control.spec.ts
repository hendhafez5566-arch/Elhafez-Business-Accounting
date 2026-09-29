import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExecutiveDashboardPage, ExecutiveDashboardView, ManagementWorkCenterPage, ManagementWorkCenterView } from './management-control-page.js';
import { createManagementControlApi, type ManagementOverview } from './management-control-client.js';
import { findRoute } from './routes.js';

const empty:ManagementOverview={generatedAt:'2026-09-23T00:00:00Z',totals:{attention:0,critical:0,high:0},domains:[],summary:{crmSales:{customers:4,agents:2,travelers:8,overdueFollowups:0,leadStages:{WON:1},quotationStatuses:{ACCEPTED:2},quotationValueByCurrency:[{currency:'EGP',total:'1000'}]},suppliers:{total:3,openDisputes:1,activeHolds:1},hajjUmrah:{activePrograms:2,readinessItems:1,criticalReadinessItems:0},finance:{overduePositions:1,overdueByCurrency:[{currency:'EGP',amount:'25'}]}},items:[]};

test('executive dashboard renders meaningful cross-domain owner KPIs',()=>{const html=renderToStaticMarkup(createElement(ExecutiveDashboardView,{data:empty}));assert.match(html,/لوحة الإدارة التنفيذية/);assert.match(html,/العملاء: 4/);assert.match(html,/1000 EGP/);assert.match(html,/النزاعات المفتوحة: 1/);assert.match(html,/البرامج النشطة: 2/);assert.match(html,/25 EGP/);assert.doesNotMatch(html,/فلاتر العمل/);});

test('work center renders all supported filters and an explicit empty state',()=>{const html=renderToStaticMarkup(createElement(ManagementWorkCenterView,{data:empty,filters:{},onFilters:()=>undefined}));for(const label of ['المجال','الأولوية','الحالة','الفئة','من تاريخ','إلى تاريخ'])assert.match(html,new RegExp(`aria-label="${label}"`));assert.match(html,/لا توجد بنود تتطلب الانتباه/);assert.doesNotMatch(html,/ملخص الأعمال/);});

test('work center rows drill down to the canonical owner workspace',()=>{const html=renderToStaticMarkup(createElement(ManagementWorkCenterView,{data:{...empty,items:[{sourceKey:'FOLLOWUP:1',sourceDomain:'CRM_SALES',sourceType:'FOLLOWUP',sourceId:'1',title:'متابعة متأخرة',summary:'اتصال',severity:'HIGH',status:'OVERDUE',companyId:'c',branchId:'b',category:'FOLLOW_UP',drillDownPath:'/crm/followups'}]},filters:{},onFilters:()=>undefined}));assert.match(html,/href="\/crm\/followups"/);assert.doesNotMatch(html,/window\.(prompt|confirm|alert)/);});

test('client sends every supported work-center filter',async()=>{let path='';const api=createManagementControlApi(async value=>{path=value;return empty;});await api.overview({domain:'FINANCE',severity:'HIGH',status:'OVERDUE',category:'FINANCIAL',from:'2026-09-01',to:'2026-09-23'});for(const fragment of ['domain=FINANCE','severity=HIGH','status=OVERDUE','category=FINANCIAL','from=2026-09-01','to=2026-09-23'])assert.match(path,new RegExp(fragment));});

test('executive and work-center routes render distinct page components',()=>{assert.match(renderToStaticMarkup(findRoute('/').element),/جارٍ تحميل/);assert.match(renderToStaticMarkup(findRoute('/management/exceptions').element),/جارٍ تحميل/);assert.notEqual(findRoute('/').element,findRoute('/management/exceptions').element);});

test('both pages expose loading state while owner composition is pending',()=>{const api={overview:()=>new Promise<ManagementOverview>(()=>undefined)};assert.match(renderToStaticMarkup(createElement(ExecutiveDashboardPage,{api})),/جارٍ تحميل/);assert.match(renderToStaticMarkup(createElement(ManagementWorkCenterPage,{api})),/جارٍ تحميل/);});

test('client omits empty filters and targets the canonical management-control endpoint',async()=>{let path='';const api=createManagementControlApi(async value=>{path=value;return empty;});await api.overview({domain:undefined,status:'',category:undefined});assert.equal(path,'/management-control/overview');});
