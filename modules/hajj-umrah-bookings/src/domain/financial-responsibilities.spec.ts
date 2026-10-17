import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFinancialResponsibilities as normalize } from './financial-responsibilities.js';
const rows=[{travelerId:'t2',financialCustomerId:'parent',amount:'20.000'},{travelerId:'t1',financialCustomerId:'parent',amount:'30'},{travelerId:'t1',financialCustomerId:'guardian',amount:'50'}];
test('reviewed individual charges can share a traveler across financial responsible parties with exact totals',()=>{const result=normalize(rows,['t1','t2'],'110','10');assert.deepEqual(result.map(x=>[x.travelerId,x.financialCustomerId,x.amount]),[['t1','guardian','50'],['t1','parent','30'],['t2','parent','20']]);assert.deepEqual(result,normalize([...rows].reverse(),['t2','t1'],'110.0','10.00'));});
test('rejects missing, foreign and duplicate travelers or debtors and an unbalanced distribution',()=>{for(const input of [rows.slice(1),[...rows,{...rows[0]!}],[...rows,{travelerId:'foreign',financialCustomerId:'parent',amount:'1'}],rows.map((x,i)=>i?x:{...x,amount:'21'}),rows.map((x,i)=>i?x:{...x,amount:'0.0000000000000000001'})])assert.throws(()=>normalize(input,['t1','t2'],'110','10'));});
