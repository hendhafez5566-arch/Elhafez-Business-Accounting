 
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  companyId,
  currencyCode,
  decimalAmount,
  type CompanyId,
} from '@elhafez/contracts';
import { PeriodControlApplicationService } from '@elhafez/period-control';
import { GeneralLedgerApplicationService } from './application/general-ledger.application-service.js';
import { InMemoryLedgerRepository } from './infrastructure/in-memory-ledger.repository.js';

class PeriodRepository {
  yearsData: any[] = [];
  periodsData: any[] = [];
  historyData: any[] = [];

  async years(company: CompanyId) {
    return this.yearsData.filter((x) => x.companyId === company);
  }

  async periods(company: CompanyId, year?: string) {
    return this.periodsData.filter(
      (x) => x.companyId === company && (!year || x.fiscalYearId === year),
    );
  }

  async saveYear(value: any) {
    this.yearsData = this.yearsData.filter(
      (x) => !(x.companyId === value.companyId && x.id === value.id),
    );
    this.yearsData.push(value);
  }

  async savePeriod(value: any) {
    this.periodsData = this.periodsData.filter(
      (x) => !(x.companyId === value.companyId && x.id === value.id),
    );
    this.periodsData.push(value);
  }

  async commitFiscalClose(year: any, history: any) {
    this.historyData.push(history);
    await this.saveYear(year);
  }

  async commitReopen(year: any, history: any) {
    this.historyData = this.historyData.filter(
      (x) => x.closeJournalId !== history.closeJournalId,
    );
    this.historyData.push(history);
    await this.saveYear(year);
  }

  async closeHistory(company: CompanyId, year: string) {
    return this.historyData.filter(
      (x) => x.companyId === company && x.fiscalYearId === year,
    );
  }
}

const company = companyId('00000000-0000-4000-8000-000000000001');
const d = (value: string) => decimalAmount(value);

async function setup() {
  const periodRepo = new PeriodRepository();
  const period = new PeriodControlApplicationService(periodRepo);
  await period.createFiscalYear({
    id: 'fy',
    companyId: company,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    status: 'OPEN',
  });
  await period.createPeriod({
    id: 'p',
    companyId: company,
    fiscalYearId: 'fy',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    status: 'OPEN',
  });

  const ledgerRepo = new InMemoryLedgerRepository();
  const ledger = new GeneralLedgerApplicationService(ledgerRepo, period);

  for (const account of [
    { id: 'cash', code: '100', classification: 'ASSET' },
    { id: 'eq', code: '300', classification: 'EQUITY' },
    { id: 'rev', code: '400', classification: 'REVENUE' },
    { id: 'exp', code: '500', classification: 'EXPENSE' },
  ] as const) {
    await ledger.createAccount({
      companyId: company,
      name: account.id,
      active: true,
      postable: true,
      ...account,
    });
  }

  return { period, ledger, ledgerRepo };
}

test('fiscal close preserves mixed decimal scales exactly and retained earnings must be equity', async () => {
  const { period, ledger } = await setup();

  await ledger.post({
    id: 'sale',
    companyId: company,
    number: 'S1',
    postingDate: '2026-06-01',
    sourceType: 'TEST',
    sourceId: 'sale',
    lines: [
      { accountId: 'cash', debit: d('100.5') },
      { accountId: 'rev', credit: d('100.5') },
    ],
  });

  await ledger.post({
    id: 'cost',
    companyId: company,
    number: 'C1',
    postingDate: '2026-06-02',
    sourceType: 'TEST',
    sourceId: 'cost',
    lines: [
      { accountId: 'exp', debit: d('30.25') },
      { accountId: 'cash', credit: d('30.25') },
    ],
  });

  const instruction = await period.prepareFiscalClose(company, 'fy');
  await assert.rejects(
    ledger.closeFiscalYear(instruction, 'cash', 'BAD-CLOSE'),
    /EQUITY/,
  );

  const close = await ledger.closeFiscalYear(instruction, 'eq', 'CL1');
  assert.deepEqual(
    close.lines.map((line) => [line.accountId, line.debit, line.credit]),
    [
      ['rev', d('100.5'), undefined],
      ['exp', undefined, d('30.25')],
      ['eq', undefined, d('70.25')],
    ],
  );
});

test('fiscal year can close, reopen, and close again with a new immutable close cycle', async () => {
  const { period, ledger } = await setup();

  await ledger.post({
    id: 'sale',
    companyId: company,
    number: 'S1',
    postingDate: '2026-06-01',
    sourceType: 'TEST',
    sourceId: 'sale',
    lines: [
      { accountId: 'cash', debit: d('10') },
      { accountId: 'rev', credit: d('10') },
    ],
  });

  const firstInstruction = await period.prepareFiscalClose(company, 'fy');
  assert.equal(firstInstruction.closeSequence, 1);
  const firstClose = await ledger.closeFiscalYear(firstInstruction, 'eq', 'CL1');
  await period.completeFiscalClose(firstInstruction, { journalId: firstClose.id });

  const reopen = await period.prepareReopen(company, 'fy');
  const reversal = await ledger.reverse(
    company,
    reopen.closeJournalId,
    '2026-12-31',
    'RCL1',
  );
  await period.completeReopen(reopen, { journalId: reversal.id });

  const secondInstruction = await period.prepareFiscalClose(company, 'fy');
  assert.equal(secondInstruction.closeSequence, 2);
  const secondClose = await ledger.closeFiscalYear(secondInstruction, 'eq', 'CL2');

  assert.notEqual(secondClose.id, firstClose.id);
  assert.equal(secondClose.sourceId, 'fy:2');
});

test('foreign posting resolves against configured company base currency, never a hard-coded currency', async () => {
  const { period, ledgerRepo } = await setup();
  const EGP = currencyCode('EGP');
  const USD = currencyCode('USD');

  const fx = {
    async getBaseCurrency(requestCompany: CompanyId) {
      assert.equal(requestCompany, company);
      return {
        companyId: company,
        code: EGP,
        precision: 2,
        isBase: true,
        status: 'ACTIVE' as const,
      };
    },
    async resolveRate(
      requestCompany: CompanyId,
      from: ReturnType<typeof currencyCode>,
      to: ReturnType<typeof currencyCode>,
    ) {
      assert.equal(requestCompany, company);
      assert.equal(from, USD);
      assert.equal(to, EGP);
      return {
        rateId: 'usd-egp',
        companyId: company,
        fromCurrency: USD,
        toCurrency: EGP,
        effectiveAt: '2026-06-01T23:59:59.999Z',
        rate: d('50'),
        source: 'TEST',
      };
    },
  };

  const ledger = new GeneralLedgerApplicationService(ledgerRepo, period, fx);
  const posted = await ledger.post({
    id: 'fx',
    companyId: company,
    number: 'FX1',
    postingDate: '2026-06-01',
    sourceType: 'TEST',
    sourceId: 'fx',
    lines: [
      {
        accountId: 'cash',
        debit: d('50'),
        foreignAmount: d('1'),
        foreignCurrency: 'USD',
      },
      { accountId: 'eq', credit: d('50') },
    ],
  });

  assert.equal(posted.lines[0]?.fxRateId, 'usd-egp');
  assert.equal(posted.lines[0]?.fxRate, d('50'));
});
