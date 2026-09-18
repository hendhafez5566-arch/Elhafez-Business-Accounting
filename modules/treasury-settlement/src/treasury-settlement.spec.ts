/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test'; import assert from 'node:assert/strict'; import {companyId,decimalAmount} from '@elhafez/contracts'; import {TreasurySettlementApplicationService} from './application/treasury-settlement.application-service.js'; import {InMemoryTreasuryRepository} from './infrastructure/in-memory-treasury.repository.js';
const company=companyId('11111111-1111-4111-8111-111111111111'),amount=(x:string)=>decimalAmount(x);
function fixture(){const repo=new InMemoryTreasuryRepository(),allocations=new Map<string,any>(),journals=new Map<string,any>();const billing={settle:async(x:any)=>{if(allocations.has(x.id))return allocations.get(x.id);const r={settlementId:x.id,allocations:[{id:x.id+':0'}],carryingBaseAmount:x.amount,prefundingBaseAmount:'0',advanceBaseAmount:'0',settlementBaseAmount:x.amount,realizedFx:'0'};allocations.set(x.id,r);return r},reverseSettlement:async(id:string)=>[{id}]};const gl={post:async(x:any)=>{const prior=journals.get(x.sourceId);if(prior)return prior;const j={...x,id:x.id};journals.set(x.sourceId,j);return j},reverse:async(_c:any,id:string)=>({id:'reverse:'+id})};const controls={evaluateApprovalRequirement:async()=>({decision:'APPROVAL_NOT_REQUIRED'}),getApprovalDecision:async()=>undefined};return{repo,service:new TreasurySettlementApplicationService(repo,billing as any,gl as any,controls as any)}}
async function setup(){const f=fixture();await f.service.createTreasury({id:'cash',companyId:company,code:'C',name:'Cash',type:'CASH',currency:'EGP',glAccountId:'cash-gl'});await f.service.createTreasury({id:'bank',companyId:company,code:'B',name:'Bank',type:'BANK',currency:'EGP',glAccountId:'bank-gl'});return f}
const receipt=(id='r1')=>({id,companyId:company,treasuryId:'cash',kind:'RECEIPT' as const,partyKind:'CUSTOMER' as const,partyId:'p',number:id,postingDate:'2026-09-18',amount:amount('100'),sourceType:'TEST',sourceId:id,controlAccountId:'ar'});
test('voucher retry, conflict, reversal, BR-025/026/027 and exact balance',async()=>{const f=await setup();const one=await f.service.postVoucher(receipt()),two=await f.service.postVoucher(receipt());assert.equal(one.id,two.id);assert.equal(await f.service.balance(company,'cash'),'100');await assert.rejects(f.service.postVoucher({...receipt(),amount:amount('99')}),/conflicting/);await assert.rejects(f.service.updateTreasury(company,'cash',{currency:'USD'}),/BR-025/);await assert.rejects(f.service.updateTreasury(company,'cash',{active:false}),/BR-026/);await assert.rejects(f.service.postVoucher({...receipt('p1'),kind:'PAYMENT',partyKind:'SUPPLIER',amount:amount('100.000000000000000001'),controlAccountId:'ap'}),/BR-027/);const reversed=await f.service.voidVoucher(company,'r1','2026-09-19','RV1');assert.equal(reversed.status,'REVERSED');assert.equal(await f.service.balance(company,'cash'),'0');assert.equal((await f.service.voidVoucher(company,'r1','2026-09-19','RV1')).reversalJournalId,reversed.reversalJournalId);assert.equal((await f.service.updateTreasury(company,'cash',{active:false})).active,false)});
test('BR-027 explicit policy, transfer, cheque and BR-028 cash count',async()=>{const f=await setup();await f.service.configurePolicy(company,true);const payment=await f.service.postVoucher({...receipt('pay'),kind:'PAYMENT',partyKind:'SUPPLIER',amount:amount('5'),controlAccountId:'ap'});assert.equal(await f.service.balance(company,'cash'),'-5');await f.service.postVoucher(receipt('fund'));const transfer=await f.service.transfer({id:'t',companyId:company,sourceTreasuryId:'cash',destinationTreasuryId:'bank',amount:amount('10'),postingDate:'2026-09-18',sourceType:'TEST',sourceId:'t',number:'T'});assert.equal(transfer.status,'POSTED');const cheque=await f.service.issueCheque({id:'ch',companyId:company,voucherId:payment.id,direction:'OUTGOING',number:'1',amount:amount('5'),currency:'EGP',issueDate:'2026-09-18'});assert.equal((await f.service.transitionCheque(company,cheque.id,'CLEARED','clear-j')).status,'CLEARED');const clean=await f.service.recordCashCount({id:'cc',companyId:company,treasuryId:'cash',countedAmount:await f.service.balance(company,'cash'),countDate:'2026-09-18'});assert.equal(clean.difference,'0');await assert.rejects(f.service.recordCashCount({id:'cc2',companyId:company,treasuryId:'cash',countedAmount:amount('0'),countDate:'2026-09-18'}),/explicit adjustment/)});
test('GS-020 conservative unique/ambiguous/unmatched/manual matching',async()=>{const f=await setup();await f.service.postVoucher(receipt('A'));await f.service.postVoucher(receipt('B'));const unique=await f.service.importBankLine({id:'l1',companyId:company,treasuryId:'bank',currency:'EGP',signedAmount:amount('100'),valueDate:'2026-09-18',reference:'none'});assert.equal((await f.service.autoMatch(company,unique.id) as any).status,'UNMATCHED');await f.service.postVoucher({...receipt('bank-r'),treasuryId:'bank',number:'REF'});const exact=await f.service.importBankLine({id:'l2',companyId:company,treasuryId:'bank',currency:'EGP',signedAmount:amount('100'),valueDate:'2026-09-18',reference:'REF'});assert.equal((await f.service.autoMatch(company,exact.id) as any).mode,'AUTO');await f.service.postVoucher({...receipt('bank-r2'),treasuryId:'bank',number:'X'});const ambiguous=await f.service.importBankLine({id:'l3',companyId:company,treasuryId:'bank',currency:'EGP',signedAmount:amount('100'),valueDate:'2026-09-18'});assert.equal((await f.service.autoMatch(company,ambiguous.id) as any).status,'AMBIGUOUS');assert.equal((await f.service.manualMatch(company,ambiguous.id,'bank-r2','actor')).mode,'MANUAL')});


test('AC-07 hardening: cash-count posting changes Treasury book position exactly once', async () => {
  const f = await setup();
  await f.service.postVoucher(receipt('cash-fund'));
  const count = await f.service.recordCashCount({
    id: 'cash-adjust',
    companyId: company,
    treasuryId: 'cash',
    countedAmount: amount('90'),
    countDate: '2026-09-18',
    adjustmentAccountId: 'cash-difference',
    number: 'CC-1',
  });
  assert.equal(count.difference, '-10');
  assert.equal(await f.service.balance(company, 'cash'), '90');
  const replay = await f.service.recordCashCount({
    id: 'cash-adjust',
    companyId: company,
    treasuryId: 'cash',
    countedAmount: amount('90'),
    countDate: '2026-09-18',
    adjustmentAccountId: 'cash-difference',
    number: 'CC-1',
  });
  assert.equal(replay.adjustmentJournalId, count.adjustmentJournalId);
  assert.equal(await f.service.balance(company, 'cash'), '90');
});

test('AC-07 hardening: reversed voucher source identity cannot be resurrected', async () => {
  const f = await setup();
  await f.service.postVoucher(receipt('no-resurrect'));
  await f.service.voidVoucher(company, 'no-resurrect', '2026-09-19', 'REV');
  await assert.rejects(f.service.postVoucher(receipt('no-resurrect')), /cannot be reposted/);
});

test('AC-07 hardening: cheque issue replay never resets a later lifecycle state', async () => {
  const f = await setup();
  const voucher = await f.service.postVoucher(receipt('cheque-voucher'));
  const input = {
    id: 'cheque-replay',
    companyId: company,
    voucherId: voucher.id,
    direction: 'INCOMING' as const,
    bankTreasuryId: 'bank',
    number: 'CHK-1',
    amount: amount('100'),
    currency: 'EGP',
    issueDate: '2026-09-18',
  };
  await f.service.issueCheque(input);
  await f.service.transitionCheque(company, 'cheque-replay', 'CLEARED', 'CLR');
  assert.equal((await f.service.issueCheque(input)).status, 'CLEARED');
});

test('AC-07 hardening: concurrent payments cannot race past negative-treasury policy', async () => {
  const f = await setup();
  await f.service.postVoucher(receipt('race-fund'));
  const payment = (id: string) => f.service.postVoucher({
    ...receipt(id),
    kind: 'PAYMENT' as const,
    partyKind: 'SUPPLIER' as const,
    amount: amount('60'),
    controlAccountId: 'ap',
  });
  const results = await Promise.allSettled([payment('race-p1'), payment('race-p2')]);
  assert.equal(results.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal(results.filter((x) => x.status === 'rejected').length, 1);
  assert.equal(await f.service.balance(company, 'cash'), '40');
});

test('AC-07 hardening: bank match cannot be silently redirected', async () => {
  const f = await setup();
  await f.service.postVoucher({ ...receipt('bank-a'), treasuryId: 'bank', number: 'A' });
  await f.service.postVoucher({ ...receipt('bank-b'), treasuryId: 'bank', number: 'B' });
  await f.service.importBankLine({
    id: 'bank-line-fixed',
    companyId: company,
    treasuryId: 'bank',
    currency: 'EGP',
    signedAmount: amount('100'),
    valueDate: '2026-09-18',
    reference: 'A',
  });
  const match = await f.service.autoMatch(company, 'bank-line-fixed') as any;
  assert.equal(match.voucherId, 'bank-a');
  await assert.rejects(
    f.service.manualMatch(company, 'bank-line-fixed', 'bank-b', 'actor'),
    /already matched differently/,
  );
});
