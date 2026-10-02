import { Prisma, type PrismaClient } from '@prisma/client';
import { decimalAmount, type CompanyId } from '@elhafez/contracts';
import type {
  InvoiceRevenueAllocation,
  InvoiceRevenueRecognitionRepository,
} from '../application/invoice-revenue-recognition.repository.js';

type AllocationRow = {
  readonly id: string;
  readonly companyId: string;
  readonly scheduleId: string;
  readonly accountId: string;
  readonly amount: { toString(): string };
};

type AllocationOwnerRow = {
  readonly companyId: string;
  readonly scheduleId: string;
};

export class PrismaInvoiceRevenueRecognitionRepository implements InvoiceRevenueRecognitionRepository {
  constructor(private readonly db: PrismaClient) {}

  async listAllocations(companyId: CompanyId, scheduleId: string): Promise<InvoiceRevenueAllocation[]> {
    const rows = await this.db.$queryRaw<AllocationRow[]>(Prisma.sql`
      SELECT
        "id",
        "company_id" AS "companyId",
        "schedule_id" AS "scheduleId",
        "account_id" AS "accountId",
        "amount"
      FROM "ecr_invoice_revenue_allocations"
      WHERE "company_id" = ${companyId}
        AND "schedule_id" = ${scheduleId}
      ORDER BY "id" ASC
    `);
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
        const existing = await tx.$queryRaw<AllocationOwnerRow[]>(Prisma.sql`
          SELECT
            "company_id" AS "companyId",
            "schedule_id" AS "scheduleId"
          FROM "ecr_invoice_revenue_allocations"
          WHERE "id" = ${value.id}
          LIMIT 1
        `);
        const owner = existing[0];
        if (owner && (owner.companyId !== value.companyId || owner.scheduleId !== value.scheduleId)) {
          throw new Error('invoice revenue allocation ID belongs to another company or schedule');
        }
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "ecr_invoice_revenue_allocations" (
            "id",
            "company_id",
            "schedule_id",
            "account_id",
            "amount"
          ) VALUES (
            ${value.id},
            ${value.companyId},
            ${value.scheduleId},
            ${value.accountId},
            CAST(${value.amount} AS DECIMAL(38, 18))
          )
          ON CONFLICT ("id") DO UPDATE SET
            "account_id" = EXCLUDED."account_id",
            "amount" = EXCLUDED."amount"
        `);
      }
    });
  }
}
