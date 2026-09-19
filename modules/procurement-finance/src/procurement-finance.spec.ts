import assert from 'node:assert/strict';
import test from 'node:test';
import {
  companyId,
  decimalAmount,
  type CompanyId,
  type DecimalAmount,
} from '@elhafez/contracts';
import type { CreateInvoiceInput, Invoice } from '@elhafez/billing-subledgers';
import { ProcurementFinanceApplicationService } from './application/procurement-finance.application-service.js';
import { InMemoryProcurementRepository } from './infrastructure/in-memory-procurement.repository.js';

const company = companyId('company-a');

class BillingHarness {
  createCalls = 0;
  postCalls = 0;
  failPostOnce = false;
  readonly invoices = new Map<string, Invoice>();
  lastDraft?: CreateInvoiceInput;

  async createDraft(input: CreateInvoiceInput): Promise<Invoice> {
    this.createCalls++;
    this.lastDraft = input;
    const old = this.invoices.get(input.id);
    if (old) return old;
    const invoice = {
      ...input,
      status: 'DRAFT',
      requestHash: 'test-hash',
      baseTotal: decimalAmount('0'),
      outstanding: decimalAmount('0'),
      createdAt: new Date().toISOString(),
    } as Invoice;
    this.invoices.set(input.id, invoice);
    return invoice;
  }

  async postInvoice(_companyId: CompanyId, id: string): Promise<Invoice> {
    this.postCalls++;
    if (this.failPostOnce) {
      this.failPostOnce = false;
      throw new Error('Billing post unavailable');
    }
    const invoice = this.invoices.get(id);
    if (!invoice) throw new Error('invoice not found');
    if (invoice.status === 'POSTED') return invoice;
    const posted = {
      ...invoice,
      status: 'POSTED' as const,
      baseTotal: invoice.lines.reduce(
        (sum, line) => decimalAmount(String(Number(sum) + Number(line.amount))),
        decimalAmount('0'),
      ),
      outstanding: invoice.lines.reduce(
        (sum, line) => decimalAmount(String(Number(sum) + Number(line.amount))),
        decimalAmount('0'),
      ),
      journalId: `journal:${id}`,
    };
    this.invoices.set(id, posted);
    return posted;
  }

  async getOpenPosition(_companyId: CompanyId, id: string) {
    const invoice = this.invoices.get(id);
    if (!invoice) throw new Error('invoice not found');
    const documentTotal = invoice.lines.reduce(
      (sum, line) => decimalAmount(String(Number(sum) + Number(line.amount))),
      decimalAmount('0'),
    );
    return {
      invoiceId: invoice.id,
      companyId: invoice.companyId,
      partyKind: 'SUPPLIER' as const,
      partyId: invoice.partyId,
      invoiceType: invoice.type,
      currency: invoice.currency,
      documentTotal,
      outstanding: invoice.outstanding,
      baseTotal: invoice.baseTotal,
      controlAccountId: invoice.controlAccountId,
      status: invoice.status,
      postingDate: invoice.postingDate,
      deferred: false,
    };
  }

  cancel(id: string) {
    const invoice = this.invoices.get(id);
    if (!invoice) throw new Error('invoice not found');
    this.invoices.set(id, {
      ...invoice,
      status: 'CANCELLED',
      outstanding: decimalAmount('0'),
      reversalJournalId: `reversal:${id}`,
    });
  }
}

function setup() {
  const repo = new InMemoryProcurementRepository();
  const billing = new BillingHarness();
  const service = new ProcurementFinanceApplicationService(repo, billing);
  return { repo, billing, service };
}

async function approved(
  service: ProcurementFinanceApplicationService,
  id = 'po-1',
  origin: 'AUTO' | 'MANUAL' = 'AUTO',
  commitmentId?: string,
) {
  await service.setPolicy({
    companyId: company,
    commitmentTiming: 'ON_PO_APPROVAL',
    version: 1,
    effectiveFrom: '2026-09-19',
  });
  await service.createPurchaseOrder({
    id,
    companyId: company,
    ...(commitmentId ? { commitmentId } : {}),
    supplierId: 'supplier-1',
    number: id,
    origin,
    lines: [
      {
        id: `${id}-line`,
        itemReference: 'service',
        orderedQuantity: decimalAmount('10'),
      },
    ],
  });
  return service.approvePurchaseOrder(company, id);
}

function conversionCommand(
  quantity: DecimalAmount = decimalAmount('4'),
  amount: DecimalAmount = decimalAmount('400'),
) {
  return {
    id: 'conversion',
    companyId: company,
    purchaseOrderId: 'po-1',
    lineId: 'po-1-line',
    quantity,
    billing: {
      invoiceId: 'invoice',
      number: 'INV',
      externalInvoiceNumber: 'EXT',
      postingDate: '2026-09-19',
      currency: 'EGP',
      controlAccountId: 'ap',
      accountId: 'expense',
      amount,
    },
  };
}

test('BR-067 rejects unsupported policy and PO approval actualizes linked commitment', async () => {
  const { service } = setup();
  await assert.rejects(
    service.setPolicy({
      companyId: company,
      commitmentTiming: 'ON_RECEIPT',
      version: 1,
      effectiveFrom: '2026-09-19',
    }),
  );

  const commitment = {
    id: 'c1',
    companyId: company,
    supplierId: 'supplier-1',
    sourceType: 'PROGRAM',
    sourceId: 'p',
    effectiveDate: '2026-09-19',
  };
  assert.equal(
    (await service.createSupplierCommitment(commitment)).id,
    (await service.createSupplierCommitment(commitment)).id,
  );
  await assert.rejects(
    service.createSupplierCommitment({ ...commitment, supplierId: 'other' }),
  );

  await approved(service, 'po-1', 'AUTO', 'c1');
  assert.equal((await service.getSupplierCommitment(company, 'c1')).status, 'COMMITTED');
});

test('GS-029 cancels approved unconverted auto PO with audit and no Billing side effect', async () => {
  const { service, billing } = setup();
  await approved(service);
  assert.equal((await service.cancelPurchaseOrder(company, 'po-1')).status, 'CANCELLED');
  assert.equal((await service.getHistory(company, 'po-1')).at(-1)?.kind, 'CANCELLED');
  assert.equal(billing.createCalls, 0);
  assert.equal(billing.postCalls, 0);
});

test('GS-030 disposes only economically empty draft auto PO and replay is safe', async () => {
  const { service } = setup();
  await service.createPurchaseOrder({
    id: 'empty',
    companyId: company,
    supplierId: 's',
    number: 'E',
    origin: 'AUTO',
    lines: [
      { id: 'l', itemReference: 'x', orderedQuantity: decimalAmount('1') },
    ],
  });
  assert.equal(
    (await service.disposeDraftAutoPurchaseOrder(company, 'empty')).status,
    'DISPOSED',
  );
  assert.equal(
    (await service.disposeDraftAutoPurchaseOrder(company, 'empty')).status,
    'DISPOSED',
  );

  await service.createPurchaseOrder({
    id: 'manual',
    companyId: company,
    supplierId: 's',
    number: 'M',
    origin: 'MANUAL',
    lines: [
      { id: 'm', itemReference: 'x', orderedQuantity: decimalAmount('1') },
    ],
  });
  await assert.rejects(service.disposeDraftAutoPurchaseOrder(company, 'manual'));
});

test('partial receipt, concurrent over-receipt, blocker and cross-company isolation', async () => {
  const { service } = setup();
  await approved(service);
  await service.receivePurchaseOrder({
    companyId: company,
    purchaseOrderId: 'po-1',
    lineId: 'po-1-line',
    quantity: decimalAmount('6'),
    commandId: 'r1',
  });

  const outcomes = await Promise.allSettled([
    service.receivePurchaseOrder({
      companyId: company,
      purchaseOrderId: 'po-1',
      lineId: 'po-1-line',
      quantity: decimalAmount('5'),
      commandId: 'r2',
    }),
    service.receivePurchaseOrder({
      companyId: company,
      purchaseOrderId: 'po-1',
      lineId: 'po-1-line',
      quantity: decimalAmount('4'),
      commandId: 'r3',
    }),
  ]);
  assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(
    (await service.getCancellationBlockers(company, { purchaseOrderId: 'po-1' }))
      .length,
    1,
  );
  await assert.rejects(service.cancelPurchaseOrder(company, 'po-1'));
  await assert.rejects(
    service.getPurchaseOrder(companyId('company-b'), 'po-1'),
  );
});

test('partial invoicing does not falsely close PO and later receipt remains valid', async () => {
  const { service } = setup();
  await approved(service);
  await service.receivePurchaseOrder({
    companyId: company,
    purchaseOrderId: 'po-1',
    lineId: 'po-1-line',
    quantity: decimalAmount('5'),
    commandId: 'receipt-1',
  });

  await service.convertToSupplierInvoice(
    conversionCommand(decimalAmount('5'), decimalAmount('500')),
  );
  assert.equal(
    (await service.getPurchaseOrder(company, 'po-1')).status,
    'PARTIALLY_INVOICED',
  );

  await service.receivePurchaseOrder({
    companyId: company,
    purchaseOrderId: 'po-1',
    lineId: 'po-1-line',
    quantity: decimalAmount('5'),
    commandId: 'receipt-2',
  });
  assert.equal(
    (await service.getPurchaseOrder(company, 'po-1')).status,
    'PARTIALLY_INVOICED',
  );
});

test('GS-031 posts supplier invoice with money independent from quantity and cancellation reopens once', async () => {
  const { service, billing } = setup();
  await approved(service);
  await service.receivePurchaseOrder({
    companyId: company,
    purchaseOrderId: 'po-1',
    lineId: 'po-1-line',
    quantity: decimalAmount('10'),
    commandId: 'receipt',
  });

  const command = conversionCommand(decimalAmount('4'), decimalAmount('725.50'));
  await Promise.all([
    service.convertToSupplierInvoice(command),
    service.convertToSupplierInvoice(command),
  ]);

  assert.equal(billing.lastDraft?.lines[0]?.amount, '725.50');
  assert.equal(billing.invoices.get('invoice')?.status, 'POSTED');
  assert.equal(
    (await service.getRemainingUninvoicedQuantities(company, 'po-1'))[0]?.quantity,
    '6',
  );

  await assert.rejects(
    service.reopenAfterSupplierInvoiceCancellation({
      companyId: company,
      conversionId: 'conversion',
      billingInvoiceId: 'invoice',
      eventId: 'cancelled',
    }),
    /cancelled supplier invoice/,
  );

  billing.cancel('invoice');
  await service.reopenAfterSupplierInvoiceCancellation({
    companyId: company,
    conversionId: 'conversion',
    billingInvoiceId: 'invoice',
    eventId: 'cancelled',
  });
  await service.reopenAfterSupplierInvoiceCancellation({
    companyId: company,
    conversionId: 'conversion',
    billingInvoiceId: 'invoice',
    eventId: 'cancelled',
  });

  assert.equal(
    (await service.getRemainingUninvoicedQuantities(company, 'po-1'))[0]?.quantity,
    '10',
  );
});

test('Billing post failure retries without double-consuming PO quantity', async () => {
  const { service, billing } = setup();
  await approved(service);
  await service.receivePurchaseOrder({
    companyId: company,
    purchaseOrderId: 'po-1',
    lineId: 'po-1-line',
    quantity: decimalAmount('10'),
    commandId: 'receipt',
  });

  billing.failPostOnce = true;
  const command = conversionCommand(decimalAmount('4'), decimalAmount('400'));
  await assert.rejects(service.convertToSupplierInvoice(command), /Billing post unavailable/);
  assert.equal(
    (await service.getRemainingUninvoicedQuantities(company, 'po-1'))[0]?.quantity,
    '6',
  );

  await service.convertToSupplierInvoice(command);
  assert.equal(
    (await service.getRemainingUninvoicedQuantities(company, 'po-1'))[0]?.quantity,
    '6',
  );
  assert.equal(billing.invoices.get('invoice')?.status, 'POSTED');
});

test('over-invoicing and conflicting receipt replay are blocked', async () => {
  const { service } = setup();
  await approved(service);
  await service.receivePurchaseOrder({
    companyId: company,
    purchaseOrderId: 'po-1',
    lineId: 'po-1-line',
    quantity: decimalAmount('2'),
    commandId: 'receipt',
  });

  await assert.rejects(
    service.convertToSupplierInvoice(
      conversionCommand(decimalAmount('3'), decimalAmount('300')),
    ),
  );
  await assert.rejects(
    service.receivePurchaseOrder({
      companyId: company,
      purchaseOrderId: 'po-1',
      lineId: 'po-1-line',
      quantity: decimalAmount('1'),
      commandId: 'receipt',
    }),
  );
});
