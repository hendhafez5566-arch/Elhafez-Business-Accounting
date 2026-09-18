import { ContractValidationError } from '@elhafez/contracts';
import type { TreasuryRepository } from '../application/treasury.repository.js';
import type {
  BankLine,
  BankMatch,
  CashCount,
  Cheque,
  Transfer,
  Treasury,
  TreasuryPolicy,
  Voucher,
} from '../domain/treasury.js';

export class InMemoryTreasuryRepository implements TreasuryRepository {
  treasuriesValues: Treasury[] = [];
  policies: TreasuryPolicy[] = [];
  voucherValues: Voucher[] = [];
  transferValues: Transfer[] = [];
  cheques: Cheque[] = [];
  counts: CashCount[] = [];
  lines: BankLine[] = [];
  matches: BankMatch[] = [];

  private put<T extends { companyId: string; id: string }>(values: T[], value: T) {
    const index = values.findIndex((x) => x.companyId === value.companyId && x.id === value.id);
    if (index < 0) values.push(value);
    else values[index] = value;
  }

  async treasury(companyId: string, id: string) {
    return this.treasuriesValues.find((x) => x.companyId === companyId && x.id === id);
  }
  async treasuries(companyId: string) {
    return this.treasuriesValues.filter((x) => x.companyId === companyId);
  }
  async saveTreasury(value: Treasury) {
    this.put(this.treasuriesValues, value);
  }

  async policy(companyId: string) {
    return this.policies.find((x) => x.companyId === companyId);
  }
  async savePolicy(value: TreasuryPolicy) {
    const index = this.policies.findIndex((x) => x.companyId === value.companyId);
    if (index < 0) this.policies.push(value);
    else this.policies[index] = value;
  }

  async voucher(companyId: string, id: string) {
    return this.voucherValues.find((x) => x.companyId === companyId && x.id === id);
  }
  async voucherBySource(companyId: string, type: string, id: string) {
    return this.voucherValues.find(
      (x) => x.companyId === companyId && x.sourceType === type && x.sourceId === id,
    );
  }
  async vouchers(companyId: string, treasuryId?: string) {
    return this.voucherValues.filter(
      (x) => x.companyId === companyId && (!treasuryId || x.treasuryId === treasuryId),
    );
  }
  async saveVoucher(value: Voucher) {
    this.put(this.voucherValues, value);
  }

  async transferBySource(companyId: string, type: string, id: string) {
    return this.transferValues.find(
      (x) => x.companyId === companyId && x.sourceType === type && x.sourceId === id,
    );
  }
  async transfers(companyId: string) {
    return this.transferValues.filter((x) => x.companyId === companyId);
  }
  async saveTransfer(value: Transfer) {
    this.put(this.transferValues, value);
  }

  async createCheque(value: Cheque) {
    if (await this.cheque(value.companyId, value.id)) {
      throw new ContractValidationError('cheque', 'already exists');
    }
    this.cheques.push(value);
  }
  async saveCheque(value: Cheque) {
    this.put(this.cheques, value);
  }
  async cheque(companyId: string, id: string) {
    return this.cheques.find((x) => x.companyId === companyId && x.id === id);
  }

  async cashCount(companyId: string, id: string) {
    return this.counts.find((x) => x.companyId === companyId && x.id === id);
  }
  async cashCounts(companyId: string, treasuryId?: string) {
    return this.counts.filter(
      (x) => x.companyId === companyId && (!treasuryId || x.treasuryId === treasuryId),
    );
  }
  async saveCashCount(value: CashCount) {
    this.put(this.counts, value);
  }

  async saveBankLine(value: BankLine) {
    this.put(this.lines, value);
  }
  async bankLine(companyId: string, id: string) {
    return this.lines.find((x) => x.companyId === companyId && x.id === id);
  }
  async bankLines(companyId: string, treasuryId: string) {
    return this.lines.filter((x) => x.companyId === companyId && x.treasuryId === treasuryId);
  }

  async saveBankMatchEffect(value: BankMatch, lineBefore: BankLine, lineAfter: BankLine) {
    const current = await this.bankLine(lineBefore.companyId, lineBefore.id);
    if (!current || current.status !== lineBefore.status) {
      throw new ContractValidationError('bankLine', 'changed while matching');
    }
    if (await this.bankMatch(value.companyId, value.lineId)) {
      throw new ContractValidationError('bankMatch', 'line already matched');
    }
    this.matches.push(value);
    this.put(this.lines, lineAfter);
  }
  async bankMatch(companyId: string, lineId: string) {
    return this.matches.find((x) => x.companyId === companyId && x.lineId === lineId);
  }
}
