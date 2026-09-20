/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test';
import assert from 'node:assert/strict';
import { companyId, currencyCode, decimalAmount, money } from '@elhafez/contracts';
import {
  BillingSubledgersApplicationService,
  type CreateInvoiceInput,
} from './application/billing-subledgers.application-service.js';
import { InMemoryBillingRepository } from './infrastructure/in-memory-billing.repository.js';

const company = companyId('11111111-1111-4111-8111-111111111111');
const amount = (value: string) => decimalAmount(value);

function fixture() {
  const repository = new InMemoryBillingRepository();
  const journals: any[] = [];
  const tax = {
    snapshotInvoiceLine: async (input: any) => ({
      id: 'snap:' + input.sourceId,
      companyId: input.companyId,
      policyId: 'policy',
      code: input.code,
      effectiveAt: input.effectiveAt,
      rate: amount('0.1'),
      taxableAmount: input.taxableAmount,
      taxAmount: amount('10'),
      outputAccountId: 'tax-out',
      inputAccountId: 'tax-in',
      createdAt: new Date().toISOString(),
    }),
  };
  const fx = {
    getBaseCurrency: async () => ({
      companyId: company,
      code: currencyCode('EGP'),
      precision: 2,
      isBase: true,
      status: 'ACTIVE' as const,
    }),
    calculateSettlement: async (_companyId: unknown, source: any, to: any, at: string) => ({
      converted: money(
        source.currency === 'USD'
          ? decimalAmount((BigInt(source.amount.replace('.', '')) * (at.startsWith('2026-09-18') ? 60n : 50n)).toString())
          : source.amount,
        to,
      ),
      rate: {
        rateId: 'usd-egp',
        companyId: company,
        fromCurrency: source.currency,
        toCurrency: to,
        effectiveAt: '2026-09-01T23:59:59.999Z',
        rate: amount(at.startsWith('2026-09-18') ? '60' : '50'),
        source: 'TEST',
      },
    }),
  };
  const gl = {
    post: async (input: any) => {
      journals.push(input);
      return { ...input, lines: input.lines };
    },
    reverse: async (_companyId: unknown, id: string) => ({ id: 'reverse:' + id }),
  };
  return {
    repository,
    journals,
    service: new BillingSubledgersApplicationService(repository, tax as any, fx as any, gl as any),
  };
}

function invoice(overrides: Partial<CreateInvoiceInput> = {}): CreateInvoiceInput {
  return {
    id: 'i1',
    companyId: company,
    type: 'CUSTOMER',
    partyId: 'party',
    number: 'INV-1',
    postingDate: '2026-09-01',
    currency: 'EGP',
    sourceType: 'ORDER',
    sourceId: 'o1',
    controlAccountId: 'ar',
    lines: [{ id: 'l1', accountId: 'revenue', amount: amount('100') }],
    ...overrides,
  };
}

test('GS-001 customer invoice balances and BR-004 supplies party dimension', async () => {
  const f = fixture();
  const draft = await f.service.createDraft(invoice());
  const posted = await f.service.postInvoice(company, draft.id);
  assert.equal(posted.outstanding, '100');
  assert.deepEqual(f.journals[0].lines, [
    { accountId: 'ar', debit: '100', partyId: 'party' },
    { accountId: 'revenue', credit: '100' },
  ]);
});

test('GS-002 supplier VAT uses frozen snapshot and balanced AP', async () => {
  const f = fixture();
  await f.service.createDraft(
    invoice({
      type: 'SUPPLIER',
      externalInvoiceNumber: 'EXT',
      controlAccountId: 'ap',
      lines: [{ id: 'l1', accountId: 'expense', amount: amount('100'), taxCode: 'VAT' }],
    }),
  );
  const posted = await f.service.postInvoice(company, 'i1');
  assert.equal(posted.baseTotal, '110');
  assert.equal(posted.lines[0]?.taxSnapshotId, 'snap:i1:l1');
  assert.equal(f.journals[0].lines.at(-1).partyId, 'party');
});

test('foreign currency invoice is converted to base and preserves GL foreign evidence', async () => {
  const f = fixture();
  await f.service.createDraft(
    invoice({
      currency: 'USD',
      lines: [{ id: 'l1', accountId: 'revenue', amount: amount('2') }],
    }),
  );
  const posted = await f.service.postInvoice(company, 'i1');
  assert.equal(posted.baseTotal, '100');
  assert.equal(posted.fxRateId, 'usd-egp');
  assert.equal(f.journals[0].lines[0].debit, '100');
  assert.equal(f.journals[0].lines[0].foreignAmount, '2');
  assert.equal(f.journals[0].lines[0].foreignCurrency, 'USD');
});

test('BR-007 supplier external number and conflicting replay are rejected', async () => {
  const f = fixture();
  await f.service.createDraft(invoice({ type: 'SUPPLIER', externalInvoiceNumber: 'X' }));
  await assert.rejects(
    f.service.createDraft(invoice({ id: 'i2', sourceId: 'o2', type: 'SUPPLIER', externalInvoiceNumber: 'X' })),
  );
  await assert.rejects(f.service.createDraft(invoice({ number: 'changed' })));
});

test('BR-008 exact credit boundary passes and excess is blocked', async () => {
  const f = fixture();
  await f.service.setCreditLimit(company, 'party', amount('100'));
  await f.service.createDraft(invoice());
  await f.service.postInvoice(company, 'i1');
  await f.service.createDraft(
    invoice({
      id: 'i2',
      sourceId: 'o2',
      number: '2',
      lines: [{ id: 'l2', accountId: 'revenue', amount: amount('0.1') }],
    }),
  );
  await assert.rejects(f.service.postInvoice(company, 'i2'), /creditLimit/i);
});

test('BR-012/013 prefunding applies once and excess becomes advance', async () => {
  const f = fixture();
  await f.service.createDraft(invoice());
  await f.service.applyAllocation({
    id: 'a1',
    companyId: company,
    partyKind: 'CUSTOMER',
    partyId: 'party',
    invoiceId: 'i1',
    amount: amount('120'),
    sourceType: 'SETTLEMENT',
    sourceId: 's1',
  });
  const posted = await f.service.postInvoice(company, 'i1');
  assert.equal(posted.outstanding, '0');
  assert.equal((await f.service.availableAdvances(company, 'CUSTOMER', 'party'))[0]?.available, '20');
});

test('allocation rejects negative amounts and party-kind mismatch', async () => {
  const f = fixture();
  await f.service.createDraft(invoice());
  await assert.rejects(
    f.service.applyAllocation({
      id: 'negative',
      companyId: company,
      partyKind: 'CUSTOMER',
      partyId: 'party',
      invoiceId: 'i1',
      amount: amount('-1'),
      sourceType: 'SETTLEMENT',
      sourceId: 'neg',
    }),
    /positive/,
  );
  await assert.rejects(
    f.service.applyAllocation({
      id: 'wrong-kind',
      companyId: company,
      partyKind: 'SUPPLIER',
      partyId: 'party',
      invoiceId: 'i1',
      amount: amount('1'),
      sourceType: 'SETTLEMENT',
      sourceId: 'wrong-kind',
    }),
    /party kind/,
  );
});

test('BR-014 restricted supplier advance cannot cross source', async () => {
  const f = fixture();
  await f.service.applyAllocation({
    id: 'a',
    companyId: company,
    partyKind: 'SUPPLIER',
    partyId: 's',
    amount: amount('50'),
    sourceType: 'PAY',
    sourceId: '1',
    restrictionSourceType: 'CONTRACT',
    restrictionSourceId: 'c1',
  });
  await assert.rejects(
    f.service.consumeAdvance({
      companyId: company,
      advanceId: 'advance:a',
      amount: amount('1'),
      sourceType: 'SUPPLIER_CANCELLATION_CHARGE',
      sourceId: 'x',
      invoiceSourceType: 'CONTRACT',
      invoiceSourceId: 'c2',
    }),
  );
});

test('advance consumption replay is idempotent and cannot double-decrement', async () => {
  const f = fixture();
  await f.service.applyAllocation({
    id: 'a',
    companyId: company,
    partyKind: 'CUSTOMER',
    partyId: 'party',
    amount: amount('20'),
    sourceType: 'PAY',
    sourceId: '1',
  });
  const command = {
    companyId: company,
    advanceId: 'advance:a',
    amount: amount('5'),
    sourceType: 'CUSTOMER_CANCELLATION_FEE' as const,
    sourceId: 'fee',
  };
  assert.equal((await f.service.consumeAdvance(command)).available, '15');
  assert.equal((await f.service.consumeAdvance(command)).available, '15');
});

test('BR-015 cancellation is linked, immutable and idempotent', async () => {
  const f = fixture();
  await f.service.createDraft(invoice());
  await f.service.postInvoice(company, 'i1');
  const first = await f.service.cancelInvoice(company, 'i1', '2026-09-02', 'R1');
  const second = await f.service.cancelInvoice(company, 'i1', '2026-09-02', 'R1');
  assert.equal(first.reversalJournalId, second.reversalJournalId);
  assert.equal(f.repository.invoiceValues.length, 1);
});

test('invoice cancellation blocks active adjustments', async () => {
  const f = fixture();
  await f.service.createDraft(invoice());
  await f.service.postInvoice(company, 'i1');
  await f.service.createAdjustment({
    id: 'cn',
    companyId: company,
    invoiceId: 'i1',
    kind: 'CREDIT_NOTE',
    amount: amount('10'),
    sourceType: 'CN',
    sourceId: '1',
    postingDate: '2026-09-02',
    number: 'CN1',
    offsetAccountId: 'returns',
  });
  await assert.rejects(
    f.service.cancelInvoice(company, 'i1', '2026-09-03', 'R1'),
    /downstream billing effects/,
  );
});

test('GS-009 credit note excess creates advance and consumed downstream blocks reversal', async () => {
  const f = fixture();
  await f.service.createDraft(invoice());
  await f.service.postInvoice(company, 'i1');
  const adjustment = await f.service.createAdjustment({
    id: 'cn',
    companyId: company,
    invoiceId: 'i1',
    kind: 'CREDIT_NOTE',
    amount: amount('120'),
    sourceType: 'CN',
    sourceId: '1',
    postingDate: '2026-09-02',
    number: 'CN1',
    offsetAccountId: 'returns',
  });
  assert.ok(adjustment.advanceId);
  await f.service.consumeAdvance({
    companyId: company,
    advanceId: adjustment.advanceId!,
    amount: amount('1'),
    sourceType: 'CUSTOMER_CANCELLATION_FEE',
    sourceId: 'fee',
  });
  await assert.rejects(
    f.service.reverseAdjustment(company, 'cn', '2026-09-03', 'RCN'),
    /BLOCKED/,
  );
});

test('unconsumed credit-note advance is reversed with the adjustment', async () => {
  const f = fixture();
  await f.service.createDraft(invoice());
  await f.service.postInvoice(company, 'i1');
  await f.service.createAdjustment({
    id: 'cn',
    companyId: company,
    invoiceId: 'i1',
    kind: 'CREDIT_NOTE',
    amount: amount('120'),
    sourceType: 'CN',
    sourceId: '1',
    postingDate: '2026-09-02',
    number: 'CN1',
    offsetAccountId: 'returns',
  });
  await f.service.reverseAdjustment(company, 'cn', '2026-09-03', 'RCN');
  assert.equal((await f.service.availableAdvances(company, 'CUSTOMER', 'party')).length, 0);
  assert.equal(await f.service.invoiceOutstanding(company, 'i1'), '100');
});

test('BR-018 recognition blocks deferred adjustment', async () => {
  const f = fixture();
  await f.service.createDraft(invoice({ deferred: true }));
  await f.service.postInvoice(company, 'i1');
  await f.service.recordRecognitionStarted(company, 'i1', 'schedule');
  await assert.rejects(
    f.service.createAdjustment({
      id: 'cn',
      companyId: company,
      invoiceId: 'i1',
      kind: 'CREDIT_NOTE',
      amount: amount('1'),
      sourceType: 'CN',
      sourceId: '1',
      postingDate: '2026-09-02',
      number: 'CN',
      offsetAccountId: 'x',
    }),
    /recognition/,
  );
});

test('BR-018 stale adjustment state cannot cross an atomic recognition start', async () => {
  const f = fixture();
  await f.service.createDraft(invoice({ deferred: true }));
  await f.service.postInvoice(company, 'i1');
  const stale = (await f.repository.invoice(company, 'i1'))!;
  await f.service.recordRecognitionStarted(company, 'i1', 'schedule-race');
  await assert.rejects(
    f.repository.saveAdjustmentEffect(
      {
        id: 'stale-adjustment',
        companyId: company,
        invoiceId: 'i1',
        kind: 'CREDIT_NOTE',
        amount: amount('1'),
        appliedAmount: amount('1'),
        advanceAmount: amount('0'),
        sourceType: 'RACE',
        sourceId: '1',
        requestHash: 'race',
        journalId: 'race-journal',
      },
      stale,
      { ...stale, outstanding: amount('99') },
    ),
    /concurrency/,
  );
});

test('BR-020/021 advance charge consumption and BR-022 write-off cap', async () => {
  const f = fixture();
  await f.service.applyAllocation({
    id: 'a',
    companyId: company,
    partyKind: 'CUSTOMER',
    partyId: 'party',
    amount: amount('20'),
    sourceType: 'PAY',
    sourceId: '1',
  });
  assert.equal(
    (
      await f.service.consumeAdvance({
        companyId: company,
        advanceId: 'advance:a',
        amount: amount('5'),
        sourceType: 'CUSTOMER_CANCELLATION_FEE',
        sourceId: 'fee',
      })
    ).available,
    '15',
  );
  await f.service.createDraft(invoice());
  await f.service.postInvoice(company, 'i1');
  await assert.rejects(
    f.service.createAdjustment({
      id: 'w',
      companyId: company,
      invoiceId: 'i1',
      kind: 'WRITE_OFF',
      amount: amount('101'),
      sourceType: 'WO',
      sourceId: '1',
      postingDate: '2026-09-02',
      number: 'WO',
      offsetAccountId: 'bad-debt',
    }),
    /exceed/,
  );
});

test('GS-019 opening customer balance uses OPENING journal semantics', async () => {
  const f = fixture();
  await f.service.createDraft(
    invoice({
      type: 'OPENING_CUSTOMER_BALANCE',
      lines: [{ id: 'l', accountId: 'opening-equity', amount: amount('50') }],
    }),
  );
  await f.service.postInvoice(company, 'i1');
  assert.equal(f.journals[0].kind, 'OPENING');
});

test('GS-003 BR-010 settlement allocates multiple invoices by explicit oldest due date and replays once', async () => {
  const f=fixture();
  for (const [id,due,total] of [['late','2026-10-20','40'],['old','2026-09-20','30'],['middle','2026-10-01','50']] as const) {
    await f.service.createDraft(invoice({id,sourceId:'src-'+id,number:'N-'+id,dueDate:due,lines:[{id:'l-'+id,accountId:'revenue',amount:amount(total)}]}));
    await f.service.postInvoice(company,id);
  }
  const command={id:'settle-1',companyId:company,partyKind:'CUSTOMER' as const,partyId:'party',amount:amount('100'),settlementCurrency:'EGP',settlementDate:'2026-10-22'};
  const first=await f.service.settle(command), replay=await f.service.settle(command);
  assert.deepEqual(first.allocations.map(x=>[x.invoiceId,x.appliedAmount]),[['old','30'],['middle','50'],['late','20']]);
  assert.deepEqual(replay.allocations.map(x=>x.id),first.allocations.map(x=>x.id));
  assert.equal(await f.service.invoiceOutstanding(company,'late'),'20');
  await assert.rejects(f.service.settle({...command,amount:amount('101')}),/conflicting replay/);
});

test('GS-004/GS-005/GS-006 prefunding remains Billing-owned and source restricted', async()=>{
 const f=fixture(); await f.service.createDraft(invoice({dueDate:'2026-10-01'}));
 const result=await f.service.settle({id:'pre',companyId:company,partyKind:'CUSTOMER',partyId:'party',amount:amount('120'),settlementCurrency:'EGP',settlementDate:'2026-09-01',explicitDraftInvoiceId:'i1',prefundingAccountId:'customer-advance'});
 assert.equal(result.allocations[0]?.invoiceId,'i1');
 assert.equal(result.prefundingBaseAmount,'120'); assert.equal(result.realizedFx,'0');
 await f.service.postInvoice(company,'i1'); assert.equal(await f.service.invoiceOutstanding(company,'i1'),'0');
 assert.deepEqual(f.journals.at(-1)?.lines,[
   {accountId:'customer-advance',debit:'100',partyId:'party'},
   {accountId:'ar',credit:'100',partyId:'party'},
 ]);
 const advances=await f.service.availableAdvances(company,'CUSTOMER','party'); assert.equal(advances[0]?.available,'20');
 const supplier=await f.service.applyAllocation({id:'supplier-pre',companyId:company,partyKind:'SUPPLIER',partyId:'supplier',amount:amount('10'),sourceType:'TREASURY_SETTLEMENT',sourceId:'supplier-pre',restrictionSourceType:'CONTRACT',restrictionSourceId:'c1'});
 await assert.rejects(f.service.consumeAdvance({companyId:company,advanceId:'advance:'+supplier.id,amount:amount('1'),sourceType:'SUPPLIER_CANCELLATION_CHARGE',sourceId:'use',invoiceSourceType:'CONTRACT',invoiceSourceId:'c2'}),/restricted/);
});

test('GS-008 BR-011 foreign settlement preserves carrying/current base and realized FX evidence',async()=>{
 const f=fixture(); await f.service.createDraft(invoice({currency:'USD',dueDate:'2026-09-10',lines:[{id:'l',accountId:'revenue',amount:amount('2')}]})); await f.service.postInvoice(company,'i1');
 const result=await f.service.settle({id:'fx-settle',companyId:company,partyKind:'CUSTOMER',partyId:'party',amount:amount('2'),settlementCurrency:'USD',settlementDate:'2026-09-18'});
 assert.equal(result.carryingBaseAmount,'100'); assert.equal(result.settlementBaseAmount,'120'); assert.equal(result.realizedFx,'20'); assert.equal(result.fxRateId,'usd-egp');
 assert.equal(result.allocations[0]?.carryingBaseAmount,'100'); assert.equal(result.allocations[0]?.settlementFxRateId,'usd-egp');
});

test('AC-12 cancellation evidence distinguishes active settlement from retained reversed history', async () => {
  const f = fixture();
  const draft = await f.service.createDraft(invoice({ dueDate: '2026-09-30' }));
  await f.service.postInvoice(company, draft.id);
  await f.service.applyAllocation({ id: 'payment-1', companyId: company, partyKind: 'CUSTOMER', partyId: 'party', invoiceId: draft.id, amount: amount('25'), sourceType: 'TREASURY_SETTLEMENT', sourceId: 'voucher-1' });
  const active = await f.service.getCancellationEvidence(company, draft.id);
  assert.equal(active.hasHistoricalAllocationEvidence, true);
  assert.equal(active.settlementRequired, true);
  assert.deepEqual(active.activeAllocationIds, ['payment-1']);
  await f.service.reverseAllocation(company, 'payment-1');
  const reversed = await f.service.getCancellationEvidence(company, draft.id);
  assert.equal(reversed.hasHistoricalAllocationEvidence, true);
  assert.equal(reversed.settlementRequired, false);
  assert.equal(reversed.cancellationSafe, true);
  assert.deepEqual(reversed.activeAllocationIds, []);
});

test('BLOCKER-6 unrelated customer advance does not block invoice A cancellation', async () => {
  const service = fixture().service;
  // Create invoice A (outstanding = 100)
  const invoiceA = await service.createDraft({
    id: 'invoice-A',
    companyId: company,
    type: 'CUSTOMER',
    partyId: 'customer-1',
    number: 'INV-A',
    postingDate: '2026-09-19',
    currency: 'EGP',
    controlAccountId: 'ar',
    sourceType: 'TOURISM_PROGRAM',
    sourceId: 'program-A',
    lines: [{ id: 'line-A', amount: decimalAmount('100'), accountId: 'revenue' }],
  });
  await service.postInvoice(company, invoiceA.id);
  // Create invoice B (outstanding = 200)
  const invoiceB = await service.createDraft({
    id: 'invoice-B',
    companyId: company,
    type: 'CUSTOMER',
    partyId: 'customer-1',
    number: 'INV-B',
    postingDate: '2026-09-19',
    currency: 'EGP',
    controlAccountId: 'ar',
    sourceType: 'TOURISM_PROGRAM',
    sourceId: 'program-B',
    lines: [{ id: 'line-B', amount: decimalAmount('200'), accountId: 'revenue' }],
  });
  await service.postInvoice(company, invoiceB.id);
  // Create advance related to invoice B by paying more than outstanding (250 > 200)
  // This creates a genuine related advance/prefund of 50
  const allocationB = await service.applyAllocation({
    id: 'alloc-B',
    companyId: company,
    partyKind: 'CUSTOMER',
    partyId: 'customer-1',
    invoiceId: invoiceB.id,
    amount: decimalAmount('250'),
    sourceType: 'TREASURY_VOUCHER',
    sourceId: 'voucher-B',
  });
  assert.equal(allocationB.advanceAmount, '50', 'advance amount should be excess over invoice');
  // Invoice A should be cancellation-safe despite customer having advance from B
  const evidenceA = await service.getCancellationEvidence(company, invoiceA.id);
  assert.equal(evidenceA.cancellationSafe, true, 'invoice A should be safe - advance is not related');
  assert.equal(evidenceA.hasAvailableAdvance, false, 'invoice A should not see unrelated advance');
  // Invoice B should show the related advance and be blocked
  const evidenceB = await service.getCancellationEvidence(company, invoiceB.id);
  assert.equal(evidenceB.cancellationSafe, false, 'invoice B should not be safe - has related advance');
  assert.equal(evidenceB.hasAvailableAdvance, true, 'invoice B should see its related advance');
  // Verify reversal removes the active blocker
  await service.reverseAllocation(company, allocationB.id);
  const evidenceBAfter = await service.getCancellationEvidence(company, invoiceB.id);
  assert.equal(evidenceBAfter.cancellationSafe, true, 'after reversal, invoice B should be safe');
  // Verify historical evidence is retained
  const evidenceBHistory = await service.getCancellationEvidence(company, invoiceB.id);
  assert.equal(evidenceBHistory.hasHistoricalAllocationEvidence, true, 'historical allocation evidence retained');
});
