import type { CompanyId } from '@elhafez/contracts';
import type { Cheque } from '../domain/treasury.js';
import type { TreasuryChequeReadRepository } from './treasury-cheque-read.repository.js';

/** Read-only cheque projection owned by Treasury. Consumers must branch-scope through the canonical voucher. */
export class TreasuryChequeReadApplicationService {
  constructor(private readonly repository: TreasuryChequeReadRepository) {}

  async list(companyId: CompanyId): Promise<Cheque[]> {
    return [...await this.repository.list(companyId)].sort((left, right) =>
      (left.dueDate ?? '9999-12-31').localeCompare(right.dueDate ?? '9999-12-31') || left.id.localeCompare(right.id),
    );
  }
}
