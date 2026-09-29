import type { PrismaClient } from '@prisma/client';
import type { TreasuryChequeReadRepository } from '../application/treasury-cheque-read.repository.js';
import type { Cheque } from '../domain/treasury.js';

const day=(value:Date|string|null|undefined)=>value==null?undefined:(typeof value==='string'?value.slice(0,10):value.toISOString().slice(0,10));

export class PrismaTreasuryChequeReadRepository implements TreasuryChequeReadRepository {
  constructor(private readonly db: PrismaClient) {}

  async list(companyId: string): Promise<Cheque[]> {
    const rows=await this.db.treasuryCheque.findMany({where:{companyId},orderBy:[{dueDate:'asc'},{id:'asc'}]});
    return rows.map((value)=>({
      id:value.id,
      companyId:value.companyId,
      voucherId:value.voucherId,
      direction:value.direction as Cheque['direction'],
      ...(value.bankTreasuryId?{bankTreasuryId:value.bankTreasuryId}:{}),
      number:value.number,
      amount:String(value.amount) as Cheque['amount'],
      currency:value.currency,
      issueDate:day(value.issueDate)!,
      ...(value.dueDate?{dueDate:day(value.dueDate)}:{}),
      status:value.status as Cheque['status'],
      ...(value.clearingReference?{clearingReference:value.clearingReference}:{}),
      history:value.history as unknown as Cheque['history'],
    }));
  }
}
