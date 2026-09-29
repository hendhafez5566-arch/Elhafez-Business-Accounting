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

  private bookBalance(companyId: string, treasuryId: string, includeReservations: boolean): bigint {
    const scale = 10n ** 18n;
    const number = (value: string) => {
      const negative = value.startsWith('-');
      const unsigned = negative ? value.slice(1) : value;
      const [whole, fraction = ''] = unsigned.split('.');
      const result = BigInt(whole + fraction.padEnd(18, '0'));
      return negative ? -result : result;
    };
    let total = 0n;
    for (const voucher of this.voucherValues) {
      if (voucher.companyId !== companyId || voucher.treasuryId !== treasuryId) continue;
      if (voucher.status === 'POSTED') {
        total += voucher.kind === 'RECEIPT' ? number(voucher.amount) : -number(voucher.amount);
      } else if (includeReservations && voucher.status === 'PROCESSING' && voucher.kind === 'PAYMENT') {
        total -= number(voucher.amount);
      }
    }
    for (const transfer of this.transferValues) {
      if (transfer.companyId !== companyId) continue;
      if (transfer.status === 'POSTED') {
        if (transfer.sourceTreasuryId === treasuryId) total -= number(transfer.amount);
        if (transfer.destinationTreasuryId === treasuryId) total += number(transfer.amount);
      } else if (
        includeReservations &&
        transfer.status === 'PROCESSING' &&
        transfer.sourceTreasuryId === treasuryId
      ) {
        total -= number(transfer.amount);
      }
    }
    for (const count of this.counts) {
      if (count.companyId === companyId && count.treasuryId === treasuryId && count.adjustmentJournalId) {
        total += number(count.difference);
      }
    }
    void scale;
    return total;
  }

  async deactivateTreasury(value: Treasury) {
    const processingVoucher = this.voucherValues.some(
      (item) =>
        item.companyId === value.companyId &&
        item.treasuryId === value.id &&
        item.status === 'PROCESSING',
    );
    const processingTransfer = this.transferValues.some(
      (item) =>
        item.companyId === value.companyId &&
        item.status === 'PROCESSING' &&
        (item.sourceTreasuryId === value.id || item.destinationTreasuryId === value.id),
    );
    if (processingVoucher || processingTransfer) {
      throw new ContractValidationError('treasury', 'cannot deactivate while a movement is processing');
    }
    if (this.bookBalance(value.companyId, value.id, false) !== 0n) {
      throw new ContractValidationError('treasury', 'BR-026 nonzero treasury cannot be deactivated');
    }
    const next = { ...value, active: false };
    this.put(this.treasuriesValues, next);
    return next;
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
  async reserveVoucher(value: Voucher, allowNegative: boolean) {
    const treasury = await this.treasury(value.companyId, value.treasuryId);
    if (!treasury?.active) throw new ContractValidationError('treasury', 'inactive');
    const existing = await this.voucherBySource(value.companyId, value.sourceType, value.sourceId);
    if (existing) {
      if (existing.requestHash !== value.requestHash) {
        throw new ContractValidationError('source', 'conflicting replay');
      }
      return existing;
    }
    if (!allowNegative && value.kind === 'PAYMENT') {
      const available = this.bookBalance(value.companyId, value.treasuryId, true);
      const amount = (() => {
        const [whole, fraction = ''] = value.amount.split('.');
        return BigInt(whole + fraction.padEnd(18, '0'));
      })();
      if (available - amount < 0n) {
        throw new ContractValidationError('balance', 'BR-027 negative treasury is prohibited');
      }
    }
    this.voucherValues.push(value);
    return value;
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
  async reserveTransfer(value: Transfer, allowNegative: boolean) {
    const source = await this.treasury(value.companyId, value.sourceTreasuryId);
    const destination = await this.treasury(value.companyId, value.destinationTreasuryId);
    if (!source?.active || !destination?.active) {
      throw new ContractValidationError('treasury', 'transfer requires active treasuries');
    }
    const existing = await this.transferBySource(value.companyId, value.sourceType, value.sourceId);
    if (existing) {
      if (existing.requestHash !== value.requestHash) {
        throw new ContractValidationError('source', 'conflicting replay');
      }
      return existing;
    }
    if (!allowNegative) {
      const available = this.bookBalance(value.companyId, value.sourceTreasuryId, true);
      const [whole, fraction = ''] = value.amount.split('.');
      const amount = BigInt(whole + fraction.padEnd(18, '0'));
      if (available - amount < 0n) {
        throw new ContractValidationError('balance', 'BR-027 negative treasury is prohibited');
      }
    }
    this.transferValues.push(value);
    return value;
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
  async listCheques(companyId: string) {
    return this.cheques.filter((x) => x.companyId === companyId);
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