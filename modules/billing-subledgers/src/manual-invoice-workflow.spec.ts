import assert from 'node:assert/strict';
import test from 'node:test';
import { companyId, decimalAmount } from '@elhafez/contracts';
import type { BillingSubledgersApplicationService, CreateInvoiceInput } from './application/billing-subledgers.application-service.js';
import { ManualInvoiceWorkflowApplicationService } from './application/manual-invoice-workflow.application-service.js';
import type {
  ManualInvoiceMetadata,
  ManualInvoiceRepository,
} from './application/manual-invoice.repository.js';
import type { Invoice } from './domain/billing.js';

const company = companyId('11111111-1111-4111-8111-111111111111');

function invoiceFrom(input: CreateInvoiceInput): Invoice {
  return {
    ...input,
    status: 'DRAFT',
    lines: input.lines.map((line) => ({ ...line })),
    baseTotal: decimalAmount('0'),
    outstanding: decimalAmount('0'),
    requestHash: 'request',
    createdAt: '2026-10-02T00:00:00.000Z',
  };
}

function fixture() {
  let current: Invoice | undefined;
  let metadata: ManualInvoiceMetadata | undefined;
  let createdInput: CreateInvoiceInput | undefined;
  let posted = false;

  const billing = {
    getInvoice: async () => current,
    createDraft: async (input: CreateInvoiceInput) => {
      createdInput = input;
      current = invoiceFrom(input);
      return current;
    },
    postInvoice: async () => {
      if (!current) throw new Error('missing draft');
      posted = true;
      current = { ...current, status: 'POSTED', baseTotal: decimalAmount('240'), outstanding: decimalAmount('240') };
      return current;
    },
    cancelInvoice: async () => {
      if (!current) throw new Error('missing invoice');
      current = { ...current, status: 'CANCELLED', outstanding: decimalAmount('0') };
      return current;
    },
  } as unknown as BillingSubledgersApplicationService;

  const repository: ManualInvoiceRepository = {
    metadata: async () => metadata,
    saveMetadata: async (value) => { metadata = value; },
    replaceDraft: async () => undefined,
    cancelDraft: async () => {
      if (!current) throw new Error('missing draft');
      current = { ...current, status: 'CANCELLED' };
    },
  };

  return {
    service: new ManualInvoiceWorkflowApplicationService(billing, repository),
    current: () => current,
    metadata: () => metadata,
    createdInput: () => createdInput,
    posted: () => posted,
  };
}

const input = () => ({
  commandKey: 'cmd-1',
  companyId: company,
  branchId: 'branch-1',
  type: 'CUSTOMER' as const,
  partyId: 'party-1',
  number: 'INV-1',
  postingDate: '2026-10-02',
  dueDate: '2026-10-12',
  recognitionDate: '2026-10-05',
  paymentTerms: '10 أيام',
  currency: 'EGP',
  controlAccountId: 'ar',
  lines: [{
    id: 'line-1',
    description: 'برنامج عمرة',
    quantity: '2',
    unitPrice: '125',
    discountMode: 'FIXED' as const,
    discount: '10',
    accountId: 'revenue',
    costCenterId: 'cc-1',
  }],
});

test('manual invoice workflow preserves legacy line semantics and calculates net amount in Billing owner', async () => {
  const f = fixture();
  const result = await f.service.save(input(), 'DRAFT');
  assert.equal(result.status, 'DRAFT');
  assert.equal(f.createdInput()?.lines[0]?.amount, '240');
  assert.equal(result.lines[0]?.description, 'برنامج عمرة');
  assert.equal(result.lines[0]?.quantity, '2');
  assert.equal(result.lines[0]?.unitPrice, '125');
  assert.equal(result.lines[0]?.discount, '10');
  assert.equal(result.lines[0]?.costCenterId, 'cc-1');
  assert.equal(result.paymentTerms, '10 أيام');
  assert.equal(result.recognitionDate, '2026-10-05');
  assert.equal(f.posted(), false);
});

test('manual invoice workflow can confirm and post the same legacy payload', async () => {
  const f = fixture();
  const result = await f.service.save(input(), 'POSTED');
  assert.equal(result.status, 'POSTED');
  assert.equal(f.posted(), true);
  assert.equal(f.metadata()?.lines[0]?.description, 'برنامج عمرة');
});

test('manual invoice workflow accepts agent receivable invoices', async () => {
  const f = fixture();
  const result = await f.service.save({ ...input(), type: 'AGENT', partyId: 'agent-1' }, 'DRAFT');
  assert.equal(result.type, 'AGENT');
  assert.equal(result.partyId, 'agent-1');
});
