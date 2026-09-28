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

  private scaled(value: unknown): bigint {
    const text = String(value);
    const negative = text.startsWith('-');
    const unsigned = negative ? text.slice(1) : text;
    const [whole, fraction = ''] = unsigned.split('.');
    const result = BigInt(whole + fraction.padEnd(18, '0'));
    return negative ? -result : result;
  }

  private async lockTreasury(tx: any, companyId: string, treasuryId: string) {
    const key = companyId + ':' + treasuryId;
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`);
  }

  private async lockedBalance(tx: any, companyId: string, treasuryId: string, includeReservations: boolean) {
    const [vouchers, transfers, counts] = await Promise.all([
      tx.treasuryVoucher.findMany({
        where: {
          companyId,
          treasuryId,
          status: { in: includeReservations ? ['POSTED', 'PROCESSING'] : ['POSTED'] },
        },
        select: { kind: true, status: true, amount: true },
      }),
      tx.treasuryTransfer.findMany({
        where: {
          companyId,
          OR: [{ sourceTreasuryId: treasuryId }, { destinationTreasuryId: treasuryId }],
          status: { in: includeReservations ? ['POSTED', 'PROCESSING'] : ['POSTED'] },
        },
        select: { sourceTreasuryId: true, destinationTreasuryId: true, status: true, amount: true },
      }),
      tx.treasuryCashCount.findMany({
        where: { companyId, treasuryId, adjustmentJournalId: { not: null } },
        select: { difference: true },
      }),
    ]);
    let total = 0n;
    for (const voucher of vouchers) {
      if (voucher.status === 'POSTED') {
        total += voucher.kind === 'RECEIPT' ? this.scaled(voucher.amount) : -this.scaled(voucher.amount);
      } else if (includeReservations && voucher.kind === 'PAYMENT') {
        total -= this.scaled(voucher.amount);
      }
    }
    for (const transfer of transfers) {
      if (transfer.status === 'POSTED') {
        if (transfer.sourceTreasuryId === treasuryId) total -= this.scaled(transfer.amount);
        if (transfer.destinationTreasuryId === treasuryId) total += this.scaled(transfer.amount);
      } else if (includeReservations && transfer.sourceTreasuryId === treasuryId) {
        total -= this.scaled(transfer.amount);
      }
    }
    for (const count of counts) total += this.scaled(count.difference);
    return total;
  }

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

  async deactivateTreasury(value: Treasury) {
    return this.db.$transaction(
      async (tx) => {
        await this.lockTreasury(tx, value.companyId, value.id);
        const current = await tx.treasuryTreasury.findUnique({
          where: { companyId_id: { companyId: value.companyId, id: value.id } },
        });
        if (!current) throw new ContractValidationError('treasury', 'not found');
        const [processingVouchers, processingTransfers] = await Promise.all([
          tx.treasuryVoucher.count({
            where: { companyId: value.companyId, treasuryId: value.id, status: 'PROCESSING' },
          }),
          tx.treasuryTransfer.count({
            where: {
              companyId: value.companyId,
              status: 'PROCESSING',
              OR: [{ sourceTreasuryId: value.id }, { destinationTreasuryId: value.id }],
            },
          }),
        ]);
        if (processingVouchers > 0 || processingTransfers > 0) {
          throw new ContractValidationError('treasury', 'cannot deactivate while a movement is processing');
        }
        if ((await this.lockedBalance(tx, value.companyId, value.id, false)) !== 0n) {
          throw new ContractValidationError('treasury', 'BR-026 nonzero treasury cannot be deactivated');
        }
        const updated = await tx.treasuryTreasury.update({
          where: { companyId_id: { companyId: value.companyId, id: value.id } },
          data: {
            name: value.name,
            type: value.type,
            currency: value.currency,
            glAccountId: value.glAccountId,
            active: false,
          },
        });
        return { ...updated, type: updated.type as Treasury['type'] } as Treasury;
      },
      { isolationLevel: 'Serializable' },
    );
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
  async reserveVoucher(value: Voucher, allowNegative: boolean) {
    return this.db.$transaction(
      async (tx) => {
        await this.lockTreasury(tx, value.companyId, value.treasuryId);
        const treasury = await tx.treasuryTreasury.findUnique({
          where: { companyId_id: { companyId: value.companyId, id: value.treasuryId } },
        });
        if (!treasury?.active) throw new ContractValidationError('treasury', 'inactive');
        const existing = await tx.treasuryVoucher.findUnique({
          where: {
            companyId_sourceType_sourceId: {
              companyId: value.companyId,
              sourceType: value.sourceType,
              sourceId: value.sourceId,
            },
          },
        });
        if (existing) {
          const mapped = this.voucherValue(existing);
          if (mapped.requestHash !== value.requestHash) {
            throw new ContractValidationError('source', 'conflicting replay');
          }
          return mapped;
        }
        if (!allowNegative && value.kind === 'PAYMENT') {
          const available = await this.lockedBalance(tx, value.companyId, value.treasuryId, true);
          if (available - this.scaled(value.amount) < 0n) {
            throw new ContractValidationError('balance', 'BR-027 negative treasury is prohibited');
          }
        }
        const created = await tx.treasuryVoucher.create({
          data: {
            ...value,
            postingDate: new Date(value.postingDate + 'T00:00:00.000Z'),
            amount: new Prisma.Decimal(value.amount),
            allocationIds: value.allocationIds,
          },
        });
        return this.voucherValue(created);
      },
      { isolationLevel: 'Serializable' },
    );
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
  async reserveTransfer(value: Transfer, allowNegative: boolean) {
    return this.db.$transaction(
      async (tx) => {
        const ids = [value.sourceTreasuryId, value.destinationTreasuryId].sort();
        for (const treasuryId of ids) await this.lockTreasury(tx, value.companyId, treasuryId);
        const [source, destination] = await Promise.all([
          tx.treasuryTreasury.findUnique({
            where: { companyId_id: { companyId: value.companyId, id: value.sourceTreasuryId } },
          }),
          tx.treasuryTreasury.findUnique({
            where: { companyId_id: { companyId: value.companyId, id: value.destinationTreasuryId } },
          }),
        ]);
        if (!source?.active || !destination?.active) {
          throw new ContractValidationError('treasury', 'transfer requires active treasuries');
        }
        const existing = await tx.treasuryTransfer.findUnique({
          where: {
            companyId_sourceType_sourceId: {
              companyId: value.companyId,
              sourceType: value.sourceType,
              sourceId: value.sourceId,
            },
          },
        });
        if (existing) {
          const mapped = this.transferValue(existing);
          if (mapped.requestHash !== value.requestHash) {
            throw new ContractValidationError('source', 'conflicting replay');
          }
          return mapped;
        }
        if (!allowNegative) {
          const available = await this.lockedBalance(tx, value.companyId, value.sourceTreasuryId, true);
          if (available - this.scaled(value.amount) < 0n) {
            throw new ContractValidationError('balance', 'BR-027 negative treasury is prohibited');
          }
        }
        const created = await tx.treasuryTransfer.create({
          data: {
            ...value,
            postingDate: new Date(value.postingDate + 'T00:00:00.000Z'),
            amount: new Prisma.Decimal(value.amount),
          },
        });
        return this.transferValue(created);
      },
      { isolationLevel: 'Serializable' },
    );
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

  async listCheques(companyId: string) {
    return (await this.db.treasuryCheque.findMany({ where: { companyId } })).map(value => this.chequeValue(value));
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
