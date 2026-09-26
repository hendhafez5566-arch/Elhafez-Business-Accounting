import type { PrismaClient } from '@prisma/client';
import type { CompanyId } from '@elhafez/contracts';
import type { TaxRepository } from '../application/tax.repository.js';
import type { TaxPolicy, TaxSnapshot } from '../domain/tax.js';

export class PrismaTaxRepository implements TaxRepository {
  constructor(private readonly db: PrismaClient) {}

  async savePolicy(value: TaxPolicy) {
    await this.db.taxPolicy.create({
      data: {
        ...value,
        effectiveFrom: new Date(value.effectiveFrom + 'T00:00:00.000Z'),
        rate: value.rate,
      },
    });
  }

  async policies(companyId: CompanyId, code: string) {
    const values = await this.db.taxPolicy.findMany({ where: { companyId, code } });
    return values.map(
      (value) =>
        ({
          ...value,
          effectiveFrom: value.effectiveFrom.toISOString().slice(0, 10),
          rate: value.rate.toString(),
        }) as TaxPolicy,
    );
  }

  async listPolicies(companyId: CompanyId) {
    const values=await this.db.taxPolicy.findMany({where:{companyId},orderBy:[{code:'asc'},{effectiveFrom:'desc'}]});
    return values.map(value=>({...value,effectiveFrom:value.effectiveFrom.toISOString().slice(0,10),rate:value.rate.toString()}) as TaxPolicy);
  }

  async saveSnapshot(value: TaxSnapshot) {
    await this.db.taxSnapshot.create({
      data: {
        ...value,
        effectiveAt: new Date(value.effectiveAt + 'T00:00:00.000Z'),
        createdAt: new Date(value.createdAt),
        rate: value.rate,
        taxableAmount: value.taxableAmount,
        taxAmount: value.taxAmount,
      },
    });
  }

  async snapshot(companyId: CompanyId, id: string) {
    const value = await this.db.taxSnapshot.findUnique({
      where: { companyId_id: { companyId, id } },
    });
    return value
      ? ({
          ...value,
          effectiveAt: value.effectiveAt.toISOString().slice(0, 10),
          createdAt: value.createdAt.toISOString(),
          rate: value.rate.toString(),
          taxableAmount: value.taxableAmount.toString(),
          taxAmount: value.taxAmount.toString(),
        } as TaxSnapshot)
      : undefined;
  }
}
