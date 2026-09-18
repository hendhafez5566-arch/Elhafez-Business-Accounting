import type { PrismaClient } from '@prisma/client';
import type { CompanyId } from '@elhafez/contracts';
import type { PeriodRepository } from '../application/period.repository.js';
import type { AccountingPeriod, CloseHistory, FiscalYear } from '../domain/period.js';

const day = (date: Date): string => date.toISOString().slice(0, 10);

export class PrismaPeriodRepository implements PeriodRepository {
  constructor(private readonly db: PrismaClient) {}

  async years(companyId: CompanyId): Promise<FiscalYear[]> {
    return (
      await this.db.periodFiscalYear.findMany({ where: { companyId } })
    ).map(
      (value) =>
        ({
          ...value,
          startDate: day(value.startDate),
          endDate: day(value.endDate),
          status: value.status as 'OPEN' | 'CLOSED',
        }) as FiscalYear,
    );
  }

  async periods(companyId: CompanyId, fiscalYearId?: string): Promise<AccountingPeriod[]> {
    return (
      await this.db.periodAccountingPeriod.findMany({
        where: { companyId, ...(fiscalYearId ? { fiscalYearId } : {}) },
      })
    ).map(
      (value) =>
        ({
          ...value,
          startDate: day(value.startDate),
          endDate: day(value.endDate),
          status: value.status as 'OPEN' | 'CLOSED',
        }) as AccountingPeriod,
    );
  }

  async saveYear(value: FiscalYear): Promise<void> {
    await this.db.periodFiscalYear.upsert({
      where: { companyId_id: { companyId: value.companyId, id: value.id } },
      create: {
        ...value,
        startDate: new Date(value.startDate),
        endDate: new Date(value.endDate),
      },
      update: { status: value.status },
    });
  }

  async savePeriod(value: AccountingPeriod): Promise<void> {
    await this.db.periodAccountingPeriod.upsert({
      where: { companyId_id: { companyId: value.companyId, id: value.id } },
      create: {
        ...value,
        startDate: new Date(value.startDate),
        endDate: new Date(value.endDate),
      },
      update: { status: value.status },
    });
  }

  async commitFiscalClose(year: FiscalYear, history: CloseHistory): Promise<void> {
    await this.db.$transaction(async (tx) => {
      await tx.periodFiscalCloseHistory.upsert({
        where: {
          companyId_fiscalYearId_closeJournalId: {
            companyId: history.companyId,
            fiscalYearId: history.fiscalYearId,
            closeJournalId: history.closeJournalId,
          },
        },
        create: {
          ...history,
          closedAt: new Date(history.closedAt),
          reopenedAt: history.reopenedAt ? new Date(history.reopenedAt) : null,
        },
        update: {},
      });

      const changed = await tx.periodFiscalYear.updateMany({
        where: { companyId: year.companyId, id: year.id, status: 'OPEN' },
        data: { status: 'CLOSED' },
      });
      if (changed.count !== 1) throw new Error('fiscal year close state changed concurrently');
    });
  }

  async commitReopen(year: FiscalYear, history: CloseHistory): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const changedHistory = await tx.periodFiscalCloseHistory.updateMany({
        where: {
          companyId: history.companyId,
          fiscalYearId: history.fiscalYearId,
          closeJournalId: history.closeJournalId,
          reversalJournalId: null,
        },
        data: {
          reversalJournalId: history.reversalJournalId,
          reopenedAt: history.reopenedAt ? new Date(history.reopenedAt) : null,
        },
      });
      if (changedHistory.count !== 1) throw new Error('fiscal close history changed concurrently');

      const changedYear = await tx.periodFiscalYear.updateMany({
        where: { companyId: year.companyId, id: year.id, status: 'CLOSED' },
        data: { status: 'OPEN' },
      });
      if (changedYear.count !== 1) throw new Error('fiscal year reopen state changed concurrently');
    });
  }

  async closeHistory(companyId: CompanyId, fiscalYearId: string): Promise<CloseHistory[]> {
    return (
      await this.db.periodFiscalCloseHistory.findMany({
        where: { companyId, fiscalYearId },
        orderBy: { closedAt: 'asc' },
      })
    ).map(
      (value) =>
        ({
          ...value,
          reversalJournalId: value.reversalJournalId ?? undefined,
          closedAt: value.closedAt.toISOString(),
          reopenedAt: value.reopenedAt?.toISOString(),
        }) as CloseHistory,
    );
  }
}
