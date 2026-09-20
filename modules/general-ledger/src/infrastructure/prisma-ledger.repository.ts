/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PrismaClient } from '@prisma/client';
import type { CompanyId } from '@elhafez/contracts';
import type { LedgerRepository } from '../application/ledger.repository.js';
import type { Account, Journal, JournalLine } from '../domain/ledger.js';

export class PrismaLedgerRepository implements LedgerRepository {
  constructor(private readonly db: PrismaClient) {}

  async saveAccount(account: Account): Promise<void> {
    await this.db.glAccount.upsert({
      where: { companyId_id: { companyId: account.companyId, id: account.id } },
      create: { ...account },
      update: {
        name: account.name,
        active: account.active,
        postable: account.postable,
        code: account.code,
        classification: account.classification,
        parentId: account.parentId,
        controlType: account.controlType,
      },
    });
  }

  async account(companyId: CompanyId, id: string): Promise<Account | undefined> {
    return (await this.db.glAccount.findUnique({
      where: { companyId_id: { companyId, id } },
    })) as Account | undefined;
  }

  async accountByCode(companyId: CompanyId, code: string): Promise<Account | undefined> {
    return (await this.db.glAccount.findUnique({
      where: { companyId_code: { companyId, code } },
    })) as Account | undefined;
  }

  async hasHistory(companyId: CompanyId, id: string): Promise<boolean> {
    return !!(await this.db.glJournalLine.findFirst({
      where: { companyId, accountId: id },
    }));
  }

  async saveJournal(journal: Journal): Promise<void> {
    const prior = await this.db.glJournal.findUnique({
      where: { companyId_id: { companyId: journal.companyId, id: journal.id } },
    });
    if (prior) throw new Error('posted journals are immutable');

    await this.db.$transaction(async (tx) => {
      await tx.glJournal.create({
        data: {
          id: journal.id,
          companyId: journal.companyId,
          number: journal.number,
          postingDate: new Date(journal.postingDate),
          kind: journal.kind,
          sourceType: journal.sourceType,
          sourceId: journal.sourceId,
          requestHash: journal.requestHash,
          correlationId: journal.correlationId,
          reversalOfId: journal.reversalOfId,
          fiscalYearId: journal.fiscalYearId,
        },
      });
      await tx.glJournalLine.createMany({
        data: journal.lines.map((line) => ({
          ...line,
          companyId: journal.companyId,
          journalId: journal.id,
        })),
      });
    });
  }

  private map(value: any): Journal {
    return {
      ...value,
      postingDate: value.postingDate.toISOString().slice(0, 10),
      correlationId: value.correlationId ?? undefined,
      reversalOfId: value.reversalOfId ?? undefined,
      fiscalYearId: value.fiscalYearId ?? undefined,
      lines: value.lines.map(
        (line: any): JournalLine => ({
          ...line,
          debit: line.debit?.toString(),
          credit: line.credit?.toString(),
          partyId: line.partyId ?? undefined,
          costCenterId: line.costCenterId ?? undefined,
          foreignAmount: line.foreignAmount?.toString(),
          foreignCurrency: line.foreignCurrency ?? undefined,
          fxRateId: line.fxRateId ?? undefined,
          fxRate: line.fxRate?.toString(),
        }),
      ),
    } as Journal;
  }

  async journal(companyId: CompanyId, id: string): Promise<Journal | undefined> {
    const value = await this.db.glJournal.findUnique({
      where: { companyId_id: { companyId, id } },
      include: { lines: true },
    });
    return value ? this.map(value) : undefined;
  }

  async journalBySource(
    companyId: CompanyId,
    sourceType: string,
    sourceId: string,
  ): Promise<Journal | undefined> {
    const value = await this.db.glJournal.findUnique({
      where: { companyId_sourceType_sourceId: { companyId, sourceType, sourceId } },
      include: { lines: true },
    });
    return value ? this.map(value) : undefined;
  }

  async journals(companyId: CompanyId): Promise<Journal[]> {
    return (
      await this.db.glJournal.findMany({
        where: { companyId },
        include: { lines: true },
      })
    ).map((value) => this.map(value));
  }
}
