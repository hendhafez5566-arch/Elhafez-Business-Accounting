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
    calculateSettlement: async (_companyId: unknown, source: any, to: any) => ({
      converted: money(
        source.currency === 'USD'
          ? decimalAmount((BigInt(source.amount.replace('.', '')) * 50n).toString())
          : source.amount,
        to,
      ),
      rate: {
        rateId: 'usd-egp',
        companyId: company,
        fromCurrency: source.currency,
        toCurrency: to,
        effectiveAt: '2026-09-01T23:59:59.999Z',
        rate: amount('50'),
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
