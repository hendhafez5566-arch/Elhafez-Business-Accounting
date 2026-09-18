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

export const TREASURY_REPOSITORY = Symbol('TREASURY_REPOSITORY');

export interface TreasuryRepository {
  treasury(companyId: string, id: string): Promise<Treasury | undefined>;
  treasuries(companyId: string): Promise<Treasury[]>;
  saveTreasury(value: Treasury): Promise<void>;

  policy(companyId: string): Promise<TreasuryPolicy | undefined>;
  savePolicy(value: TreasuryPolicy): Promise<void>;

  voucher(companyId: string, id: string): Promise<Voucher | undefined>;
  voucherBySource(companyId: string, type: string, id: string): Promise<Voucher | undefined>;
  vouchers(companyId: string, treasuryId?: string): Promise<Voucher[]>;
  saveVoucher(value: Voucher): Promise<void>;

  transferBySource(companyId: string, type: string, id: string): Promise<Transfer | undefined>;
  transfers(companyId: string): Promise<Transfer[]>;
  saveTransfer(value: Transfer): Promise<void>;

  createCheque(value: Cheque): Promise<void>;
  saveCheque(value: Cheque): Promise<void>;
  cheque(companyId: string, id: string): Promise<Cheque | undefined>;

  cashCount(companyId: string, id: string): Promise<CashCount | undefined>;
  cashCounts(companyId: string, treasuryId?: string): Promise<CashCount[]>;
  saveCashCount(value: CashCount): Promise<void>;

  saveBankLine(value: BankLine): Promise<void>;
  bankLine(companyId: string, id: string): Promise<BankLine | undefined>;
  bankLines(companyId: string, treasuryId: string): Promise<BankLine[]>;

  saveBankMatchEffect(value: BankMatch, lineBefore: BankLine, lineAfter: BankLine): Promise<void>;
  bankMatch(companyId: string, lineId: string): Promise<BankMatch | undefined>;
}
