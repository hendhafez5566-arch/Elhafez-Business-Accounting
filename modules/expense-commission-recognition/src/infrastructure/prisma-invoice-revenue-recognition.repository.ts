import type { PrismaClient } from '@prisma/client';
import { decimalAmount, type CompanyId } from '@elhafez/contracts';
import type {
  InvoiceRevenueAllocation,
  InvoiceRevenueRecognitionRepository,
} from '../application/invoice-revenue-recognition.repository.js';

export class PrismaInvoiceRevenueRecognitionRepository implements InvoiceRevenueRecognitionRepository {
  constructor(private readonly db: PrismaClient) {}

  async listAllocations(companyId: CompanyId, scheduleId: string): Promise<InvoiceRevenueAllocation[]> {
    const rows = await this.db.ecrInvoiceRevenueAllocation.findMany({
      where: { companyId, scheduleId },
      orderBy: { id: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      companyId: row.companyId as CompanyId,
      scheduleId: row.scheduleId,
      accountId: row.accountId,
      amount: decimalAmount(row.amount.toString()),
    }));
  }

  async saveAllocations(values: readonly InvoiceRevenueAllocation[]): Promise<void> {
    if (!values.length) return;
    await this.db.$transaction(async (tx) => {
      for (const value of values) {
        const existing = await tx.ecrInvoiceRevenueAllocation.findUnique({ where: { id: value.id } });
        if (existing && existing.companyId !== value.companyId) {
          throw new Error('invoice revenue allocation ID belongs to another company');
        }
        await tx.ecrInvoiceRevenueAllocation.upsert({
          where: { id: value.id },
          create: value,
          update: { accountId: value.accountId, amount: value.amount },
        });
      }
    });
  }
}
