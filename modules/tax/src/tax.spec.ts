import test from 'node:test';
import assert from 'node:assert/strict';
import { companyId, decimalAmount } from '@elhafez/contracts';
import { TaxApplicationService } from './application/tax.application-service.js';
import { InMemoryTaxRepository } from './infrastructure/in-memory-tax.repository.js';

const company = companyId('11111111-1111-4111-8111-111111111111');

test('BR-009 immutable effective tax snapshots retain historical policy', async () => {
  const repository = new InMemoryTaxRepository();
  const service = new TaxApplicationService(repository);
  await service.configurePolicy({
    id: 'p1',
    companyId: company,
    code: 'VAT',
    effectiveFrom: '2026-01-01',
    rate: decimalAmount('0.1'),
    outputAccountId: 'out',
    inputAccountId: 'in',
  });
  const old = await service.snapshotInvoiceLine({
    companyId: company,
    code: 'VAT',
    effectiveAt: '2026-02-01',
    taxableAmount: decimalAmount('100'),
    sourceId: 'line-1',
  });
  await service.configurePolicy({
    id: 'p2',
    companyId: company,
    code: 'VAT',
    effectiveFrom: '2026-03-01',
    rate: decimalAmount('0.2'),
    outputAccountId: 'out',
    inputAccountId: 'in',
  });
  assert.equal(old.taxAmount, '10');
  assert.equal((await service.getSnapshot(company, old.id))?.policyId, 'p1');
});

test('tax snapshot replay rejects conflicting economic input', async () => {
  const repository = new InMemoryTaxRepository();
  const service = new TaxApplicationService(repository);
  await service.configurePolicy({
    id: 'p1',
    companyId: company,
    code: 'VAT',
    effectiveFrom: '2026-01-01',
    rate: decimalAmount('0.1'),
    outputAccountId: 'out',
    inputAccountId: 'in',
  });
  await service.snapshotInvoiceLine({
    companyId: company,
    code: 'VAT',
    effectiveAt: '2026-02-01',
    taxableAmount: decimalAmount('100'),
    sourceId: 'line-1',
  });
  await assert.rejects(
    service.snapshotInvoiceLine({
      companyId: company,
      code: 'VAT',
      effectiveAt: '2026-02-01',
      taxableAmount: decimalAmount('101'),
      sourceId: 'line-1',
    }),
    /conflicting tax snapshot replay/,
  );
});

test('tax math never silently truncates beyond database scale', async () => {
  const repository = new InMemoryTaxRepository();
  const service = new TaxApplicationService(repository);
  await service.configurePolicy({
    id: 'p1',
    companyId: company,
    code: 'VAT',
    effectiveFrom: '2026-01-01',
    rate: decimalAmount('0.333333333333333333'),
    outputAccountId: 'out',
    inputAccountId: 'in',
  });
  await assert.rejects(
    service.snapshotInvoiceLine({
      companyId: company,
      code: 'VAT',
      effectiveAt: '2026-01-01',
      taxableAmount: decimalAmount('0.1'),
      sourceId: 'line-rounding',
    }),
    /rounding policy/,
  );
});
