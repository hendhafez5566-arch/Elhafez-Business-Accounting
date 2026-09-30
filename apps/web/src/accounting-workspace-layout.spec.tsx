import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AccountingCapabilities, AccountingOverview } from './accounting-client.js';
import { AccountingWorkspaceView } from './accounting-workspace-page.js';

const overview:AccountingOverview={
 fiscalYears:[],periods:[],accounts:[],journals:[],invoices:[],treasuries:[],vouchers:[],taxPolicies:[],approvalPolicies:[],approvalRequests:[],controlIssues:[],
 reports:{trialBalance:{rows:[]},incomeStatement:{rows:[]},balanceSheet:{rows:[]},treasury:{totals:[]},tax:{totals:[],facts:[]}},
};
const capabilities:AccountingCapabilities={read:true,operate:true};
const noop=async()=>{};

test('accounting renders a grouped financial workspace instead of the legacy horizontal tab shell',()=>{
 const html=renderToStaticMarkup(createElement(AccountingWorkspaceView,{data:overview,cap:capabilities,section:'overview',onSectionChange:()=>{},notice:'',reload:noop,done:async()=>{}}));
 assert.match(html,/ui-workspace-settings/);
 assert.match(html,/aria-label="وحدات المحاسبة"/);
 assert.match(html,/القيادة المالية/);
 assert.match(html,/الأستاذ العام/);
 assert.match(html,/الذمم والنقد/);
 assert.match(html,/التخطيط والمعالجة/);
 assert.match(html,/الرقابة والتقارير/);
 assert.doesNotMatch(html,/role="tablist"/);
 assert.doesNotMatch(html,/class="ui-tabs"/);
});

test('accounting structural navigation exposes reference-specific destinations without changing financial data ownership',()=>{
 const html=renderToStaticMarkup(createElement(AccountingWorkspaceView,{data:overview,cap:capabilities,section:'accounts',onSectionChange:()=>{},notice:'',reload:noop,done:async()=>{}}));
 assert.match(html,/دليل الحسابات/);
 assert.match(html,/Chart of Accounts/);
 assert.match(html,/Journal Entry Form/);
 assert.match(html,/Billing &amp; Invoicing/);
 assert.match(html,/Treasury Settlement/);
 assert.match(html,/VAT &amp; Tax Returns/);
 assert.match(html,/Financial Reporting Center/);
});
