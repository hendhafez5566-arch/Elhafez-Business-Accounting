import assert from 'node:assert/strict';
import test from 'node:test';
import {createElement,type ComponentType} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {SystemReadinessPage} from './system-readiness-page.js';
import {accountingReadinessChecks} from './system-readiness-page.js';
import type {AccountingOverview} from './accounting-client.js';

test('document identity offers a file selection instead of an internal logo ID input',()=>{
 const previous=globalThis.window;
 Object.defineProperty(globalThis,'window',{configurable:true,value:{location:{search:'?tab=identity'}}});
 try{
  const html=renderToStaticMarkup(createElement(SystemReadinessPage as ComponentType<{context:{token:string;companyId:string;branchId:string}}>,{context:{token:'token',companyId:'company-1',branchId:'branch-1'}}));
  assert.match(html,/الشعار من مركز الملفات/);
  assert.match(html,/<select[^>]*>/);
  assert.doesNotMatch(html,/value="logoFileId"|placeholder="معرّف الشعار"/);
 }finally{Object.defineProperty(globalThis,'window',{configurable:true,value:previous});}
});

test('readiness checks require real fiscal, period, account and treasury owner data',()=>{
 const data:AccountingOverview={fiscalYears:[],periods:[],accounts:[],journals:[],invoices:[],treasuries:[],vouchers:[],taxPolicies:[],approvalPolicies:[],approvalRequests:[],controlIssues:[],reports:{trialBalance:{rows:[]},incomeStatement:{rows:[]},balanceSheet:{rows:[]},treasury:{totals:[]},tax:{totals:[],facts:[]}}};
 assert.deepEqual(accountingReadinessChecks(data).map(item=>item.status),['BLOCKED','BLOCKED','BLOCKED','BLOCKED']);
 const ready={...data,fiscalYears:[{id:'year',startDate:'2026-01-01',endDate:'2026-12-31',status:'OPEN' as const}],periods:[{id:'period',fiscalYearId:'year',startDate:'2026-09-01',endDate:'2026-09-30',status:'OPEN' as const}],accounts:[{id:'account',code:'1000',name:'نقدية',classification:'ASSET' as const,active:true,postable:true}],treasuries:[{id:'cash',code:'CASH',name:'الخزنة',type:'CASH' as const,currency:'EGP',glAccountId:'account',active:true}]};
 assert.deepEqual(accountingReadinessChecks(ready).map(item=>item.status),['READY','READY','READY','READY']);
});
