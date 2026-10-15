import test from 'node:test';
import assert from 'node:assert/strict';
import { distributeCommission } from './commission-distribution.js';
const agreement={agreementId:'agreement-1',agreementVersion:1,precision:2,principalPartyId:'parent',subordinatePartyId:'child',principalPercent:'33.333333'};
test('commission exact allocation retains monetary remainder on subordinate',()=>{assert.deepEqual(distributeCommission('100.01',agreement),[{partyId:'parent',amount:'33.33',role:'PRINCIPAL'},{partyId:'child',amount:'66.68',role:'SUBORDINATE'}]);});
test('zero/full share and zero decimal currencies preserve exact total',()=>{assert.deepEqual(distributeCommission('101',{...agreement,precision:0,principalPercent:'100'}).map(x=>x.amount),['101','0']);assert.deepEqual(distributeCommission('101',{...agreement,precision:0,principalPercent:'0'}).map(x=>x.amount),['0','101']);});
test('large amounts never enter floating point',()=>{assert.deepEqual(distributeCommission('9007199254740993.01',{...agreement,principalPercent:'50'}).map(x=>x.amount),['4503599627370496.5','4503599627370496.51']);});
test('invalid precision, beneficiary duplication and percentages fail before financial effects',()=>{assert.throws(()=>distributeCommission('1.001',agreement),/precision/);assert.throws(()=>distributeCommission('1',{...agreement,principalPercent:'100.000001'}),/100/);assert.throws(()=>distributeCommission('1',{...agreement,subordinatePartyId:'parent'}),/distinct/);});
