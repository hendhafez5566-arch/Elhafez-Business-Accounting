/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-imports */
import { PrismaClient, Prisma } from '@prisma/client';
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

const decimal = (value: unknown) => String(value);
const json = <T>(value: unknown) => value as T;
const day = (value: Date | string | null | undefined) =>
  value == null ? undefined : (typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10));

export class PrismaTreasuryRepository implements TreasuryRepository {
  constructor(private readonly db: PrismaClient) {}

  async treasury(companyId: string, id: string) {
    const value = await this.db.treasuryTreasury.findUnique({ where: { companyId_id: { companyId, id } } });
    return value ? ({ ...value, type: value.type as Treasury['type'], currency: value.currency as Treasury['currency'] } as Treasury) : undefined;
  }
  async treasuries(companyId: string) {
    return (await this.db.treasuryTreasury.findMany({ where: { companyId } })) as Treasury[];
  }
  async saveTreasury(value: Treasury) {
    await this.db.treasuryTreasury.upsert({
      where: { companyId_id: { companyId: value.companyId, id: value.id } },
      create: value,
      update: { name: value.name, type: value.type, currency: value.currency, active: value.active, glAccountId: value.glAccountId },
    });
  }

  async policy(companyId: string) {
    return ((await this.db.treasuryCompanyPolicy.findUnique({ where: { companyId } })) as unknown as TreasuryPolicy) ?? undefined;
  }
  async savePolicy(value: TreasuryPolicy) {
    await this.db.treasuryCompanyPolicy.upsert({
      where: { companyId: value.companyId },
      create: value,
      update: { allowNegative: value.allowNegative },
    });
  }

  private voucherValue(value: any): Voucher {
    return {
      ...value,
      postingDate: day(value.postingDate)!,
      amount: decimal(value.amount),
      allocationIds: json<string[]>(value.allocationIds),
      carryingBaseAmount: value.carryingBaseAmount == null ? undefined : decimal(value.carryingBaseAmount),
      settlementBaseAmount: value.settlementBaseAmount == null ? undefined : decimal(value.settlementBaseAmount),
      realizedFx: value.realizedFx == null ? undefined : decimal(value.realizedFx),
    } as Voucher;
  }
  async voucher(companyId: string, id: string) {
    const value = await this.db.treasuryVoucher.findUnique({ where: { companyId_id: { companyId, id } } });
    return value ? this.voucherValue(value) : undefined;
  }
  async voucherBySource(companyId: string, type: string, id: string) {
    const value = await this.db.treasuryVoucher.findUnique({
      where: { companyId_sourceType_sourceId: { companyId, sourceType: type, sourceId: id } },
    });
    return value ? this.voucherValue(value) : undefined;
  }
  async vouchers(companyId: string, treasuryId?: string) {
    return (
      await this.db.treasuryVoucher.findMany({
        where: { companyId, ...(treasuryId ? { treasuryId } : {}) },
      })
    ).map((value) => this.voucherValue(value));
  }
  async saveVoucher(value: Voucher) {
    const data: any = {
      ...value,
      postingDate: new Date(value.postingDate + 'T00:00:00.000Z'),
      amount: new Prisma.Decimal(value.amount),
      allocationIds: value.allocationIds,
      carryingBaseAmount: value.carryingBaseAmount ? new Prisma.Decimal(value.carryingBaseAmount) : null,
      settlementBaseAmount: value.settlementBaseAmount ? new Prisma.Decimal(value.settlementBaseAmount) : null,
      realizedFx: value.realizedFx ? new Prisma.Decimal(value.realizedFx) : null,
    };
    await this.db.treasuryVoucher.upsert({
      where: { companyId_id: { companyId: value.companyId, id: value.id } },
      create: data,
      update: data,
    });
  }

  private transferValue(value: any): Transfer {
    return { ...value, postingDate: day(value.postingDate)!, amount: decimal(value.amount) } as Transfer;
  }
  async transferBySource(companyId: string, type: string, id: string) {
    const value = await this.db.treasuryTransfer.findUnique({
      where: { companyId_sourceType_sourceId: { companyId, sourceType: type, sourceId: id } },
    });
    return value ? this.transferValue(value) : undefined;
  }
  async transfers(companyId: string) {
    return (await this.db.treasuryTransfer.findMany({ where: { companyId } })).map((value) => this.transferValue(value));
  }
  async saveTransfer(value: Transfer) {
    const data: any = {
      ...value,
      postingDate: new Date(value.postingDate + 'T00:00:00.000Z'),
      amount: new Prisma.Decimal(value.amount),
    };
    await this.db.treasuryTransfer.upsert({
      where: { companyId_id: { companyId: value.companyId, id: value.id } },
      create: data,
      update: data,
    });
  }

  private chequeValue(value: any): Cheque {
    return {
      ...value,
      amount: decimal(value.amount),
      issueDate: day(value.issueDate)!,
      dueDate: day(value.dueDate),
      history: json<Cheque['history']>(value.history),
    } as Cheque;
  }
  async createCheque(value: Cheque) {
    await this.db.treasuryCheque.create({
      data: {
        ...value,
        issueDate: new Date(value.issueDate + 'T00:00:00.000Z'),
        dueDate: value.dueDate ? new Date(value.dueDate + 'T00:00:00.000Z') : null,
        amount: new Prisma.Decimal(value.amount),
        history: value.history,
      },
    });
  }
  async saveCheque(value: Cheque) {
    await this.db.treasuryCheque.update({
      where: { companyId_id: { companyId: value.companyId, id: value.id } },
      data: {
        status: value.status,
        clearingReference: value.clearingReference,
        history: value.history,
      },
    });
  }
  async cheque(companyId: string, id: string) {
    const value = await this.db.treasuryCheque.findUnique({ where: { companyId_id: { companyId, id } } });
    return value ? this.chequeValue(value) : undefined;
  }

  private cashCountValue(value: any): CashCount {
    return {
      ...value,
      countDate: day(value.countDate)!,
      countedAmount: decimal(value.countedAmount),
      bookAmount: decimal(value.bookAmount),
      difference: decimal(value.difference),
    } as CashCount;
  }
  async cashCount(companyId: string, id: string) {
    const value = await this.db.treasuryCashCount.findUnique({ where: { companyId_id: { companyId, id } } });
    return value ? this.cashCountValue(value) : undefined;
  }
  async cashCounts(companyId: string, treasuryId?: string) {
    return (
      await this.db.treasuryCashCount.findMany({
        where: { companyId, ...(treasuryId ? { treasuryId } : {}) },
      })
    ).map((value) => this.cashCountValue(value));
  }
  async saveCashCount(value: CashCount) {
    const data: any = {
      ...value,
      countDate: new Date(value.countDate + 'T00:00:00.000Z'),
      countedAmount: new Prisma.Decimal(value.countedAmount),
      bookAmount: new Prisma.Decimal(value.bookAmount),
      difference: new Prisma.Decimal(value.difference),
    };
    await this.db.treasuryCashCount.upsert({
      where: { companyId_id: { companyId: value.companyId, id: value.id } },
      create: data,
      update: data,
    });
  }

  private bankLineValue(value: any): BankLine {
    return {
      ...value,
      valueDate: day(value.valueDate)!,
      signedAmount: decimal(value.signedAmount),
    } as BankLine;
  }
  async saveBankLine(value: BankLine) {
    await this.db.treasuryBankStatementLine.upsert({
      where: { companyId_id: { companyId: value.companyId, id: value.id } },
      create: {
        ...value,
        valueDate: new Date(value.valueDate + 'T00:00:00.000Z'),
        signedAmount: new Prisma.Decimal(value.signedAmount),
      },
      update: {
        status: value.status,
      },
    });
  }
  async bankLine(companyId: string, id: string) {
    const value = await this.db.treasuryBankStatementLine.findUnique({ where: { companyId_id: { companyId, id } } });
    return value ? this.bankLineValue(value) : undefined;
  }
  async bankLines(companyId: string, treasuryId: string) {
    return (
      await this.db.treasuryBankStatementLine.findMany({ where: { companyId, treasuryId } })
    ).map((value) => this.bankLineValue(value));
  }

  async saveBankMatchEffect(value: BankMatch, lineBefore: BankLine, lineAfter: BankLine) {
    await this.db.$transaction(
      async (tx) => {
        const existing = await tx.treasuryBankMatch.findUnique({
          where: { companyId_lineId: { companyId: value.companyId, lineId: value.lineId } },
        });
        if (existing) throw new ContractValidationError('bankMatch', 'line already matched');
        const changed = await tx.treasuryBankStatementLine.updateMany({
          where: {
            companyId: lineBefore.companyId,
            id: lineBefore.id,
            status: lineBefore.status,
          },
          data: { status: lineAfter.status },
        });
        if (changed.count !== 1) throw new ContractValidationError('bankLine', 'changed while matching');
        await tx.treasuryBankMatch.create({
          data: { ...value, matchedAt: new Date(value.matchedAt) },
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }
  async bankMatch(companyId: string, lineId: string) {
    const value = await this.db.treasuryBankMatch.findUnique({
      where: { companyId_lineId: { companyId, lineId } },
    });
    return value
      ? ({
          ...value,
          actorId: value.actorId ?? undefined,
          matchedAt: value.matchedAt.toISOString(),
        } as BankMatch)
      : undefined;
  }
}
