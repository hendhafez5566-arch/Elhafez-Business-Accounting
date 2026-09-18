import type { PrismaClient } from '@prisma/client';
import { ContractValidationError, type CompanyId, type CurrencyCode } from '@elhafez/contracts';
import type { CurrencyFxRepository } from '../application/currency-fx.repository.js';
import type { CurrencyConfiguration, FxRate } from '../domain/fx.js';

function isUniqueConstraint(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

export class PrismaCurrencyFxRepository implements CurrencyFxRepository {
  constructor(private readonly db: PrismaClient) {}

  async saveCurrency(value: CurrencyConfiguration): Promise<void> {
    const existing = await this.db.fxCurrency.findUnique({ where: { companyId_code: { companyId: value.companyId, code: value.code } } });
    if (existing?.isBase && !value.isBase) throw new ContractValidationError('currency', 'base currency cannot be changed');
    if (value.isBase) {
      const otherBase = await this.db.fxCurrency.findFirst({ where: { companyId: value.companyId, isBase: true, code: { not: value.code } } });
      if (otherBase) throw new ContractValidationError('currency', 'company already has a base currency');
    }
    try {
      await this.db.fxCurrency.upsert({
        where: { companyId_code: { companyId: value.companyId, code: value.code } },
        create: value,
        update: { precision: value.precision, isBase: value.isBase, status: value.status },
      });
    } catch (error) {
      if (isUniqueConstraint(error)) throw new ContractValidationError('currency', 'company already has a base currency');
      throw error;
    }
  }

  async findCurrency(companyId: CompanyId, code: CurrencyCode): Promise<CurrencyConfiguration | undefined> {
    return (await this.db.fxCurrency.findUnique({ where: { companyId_code: { companyId, code } } })) as CurrencyConfiguration | undefined;
  }

  async saveRate(value: FxRate): Promise<void> {
    const identity = { companyId: value.companyId, fromCurrency: value.fromCurrency, toCurrency: value.toCurrency, effectiveAt: new Date(value.effectiveAt) };
    const existing = await this.db.fxRate.findUnique({ where: { companyId_fromCurrency_toCurrency_effectiveAt: identity } });
    if (existing) {
      if (existing.id !== value.id || existing.rate.toString() !== value.rate || existing.source !== value.source) throw new ContractValidationError('rate', 'conflicting FX rate');
      return;
    }
    if (await this.db.fxRate.findUnique({ where: { id: value.id } })) throw new ContractValidationError('rate', 'rate id is already used');
    try {
      await this.db.fxRate.create({ data: { ...value, effectiveAt: identity.effectiveAt, rate: value.rate.toString() } });
    } catch (error) {
      if (!isUniqueConstraint(error)) throw error;
      const concurrent = await this.db.fxRate.findUnique({ where: { companyId_fromCurrency_toCurrency_effectiveAt: identity } });
      if (concurrent && concurrent.id === value.id && concurrent.rate.toString() === value.rate && concurrent.source === value.source) return;
      throw new ContractValidationError('rate', 'conflicting FX rate');
    }
  }

  async findRate(companyId: CompanyId, fromCurrency: CurrencyCode, toCurrency: CurrencyCode, at: string): Promise<FxRate | undefined> {
    const value = await this.db.fxRate.findFirst({ where: { companyId, fromCurrency, toCurrency, effectiveAt: { lte: new Date(at) } }, orderBy: { effectiveAt: 'desc' } });
    return value ? { ...value, effectiveAt: value.effectiveAt.toISOString(), rate: value.rate.toString() } as FxRate : undefined;
  }
}
