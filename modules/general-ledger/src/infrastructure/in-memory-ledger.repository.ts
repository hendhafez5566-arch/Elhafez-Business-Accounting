import type { CompanyId } from '@elhafez/contracts';
import type { LedgerRepository } from '../application/ledger.repository.js';
import type { Account, Journal } from '../domain/ledger.js';

export class InMemoryLedgerRepository implements LedgerRepository {
  private accounts: Account[] = [];
  private journalValues: Journal[] = [];

  async saveAccount(account: Account): Promise<void> {
    this.accounts = this.accounts.filter(
      (x) => !(x.companyId === account.companyId && x.id === account.id),
    );
    this.accounts.push(account);
  }

  async account(companyId: CompanyId, id: string): Promise<Account | undefined> {
    return this.accounts.find((x) => x.companyId === companyId && x.id === id);
  }

  async accountByCode(companyId: CompanyId, code: string): Promise<Account | undefined> {
    return this.accounts.find((x) => x.companyId === companyId && x.code === code);
  }

  async hasHistory(companyId: CompanyId, id: string): Promise<boolean> {
    return this.journalValues.some(
      (journal) =>
        journal.companyId === companyId &&
        journal.lines.some((line) => line.accountId === id),
    );
  }

  async saveJournal(journal: Journal): Promise<void> {
    const existing = this.journalValues.find(
      (x) => x.companyId === journal.companyId && x.id === journal.id,
    );
    if (existing) throw new Error('posted journals are immutable');

    this.journalValues.push(
      Object.freeze({
        ...journal,
        lines: Object.freeze([...journal.lines]),
      }),
    );
  }

  async journal(companyId: CompanyId, id: string): Promise<Journal | undefined> {
    return this.journalValues.find((x) => x.companyId === companyId && x.id === id);
  }

  async journalBySource(
    companyId: CompanyId,
    sourceType: string,
    sourceId: string,
  ): Promise<Journal | undefined> {
    return this.journalValues.find(
      (x) =>
        x.companyId === companyId &&
        x.sourceType === sourceType &&
        x.sourceId === sourceId,
    );
  }

  async journals(companyId: CompanyId): Promise<Journal[]> {
    return this.journalValues.filter((x) => x.companyId === companyId);
  }
}
