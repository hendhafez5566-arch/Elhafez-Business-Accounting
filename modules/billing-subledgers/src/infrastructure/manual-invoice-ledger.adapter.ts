import type { GeneralLedgerApplicationService } from '@elhafez/general-ledger';
import type { ManualInvoiceRepository } from '../application/manual-invoice.repository.js';

type PostInput = Parameters<GeneralLedgerApplicationService['post']>[0];
type ReverseArgs = Parameters<GeneralLedgerApplicationService['reverse']>;

/**
 * Billing-owned adapter that enriches only the commercial invoice line posting
 * dimensions. BillingSubledgersApplicationService remains the sole owner of
 * invoice posting amounts, tax, FX, allocations and lifecycle transitions.
 */
export class ManualInvoiceLedgerAdapter {
  constructor(
    private readonly ledger: GeneralLedgerApplicationService,
    private readonly workflow: ManualInvoiceRepository,
  ) {}

  async post(input: PostInput) {
    if (input.sourceType !== 'BILLING_INVOICE') return this.ledger.post(input);
    const metadata = await this.workflow.metadata(input.companyId, input.sourceId);
    if (!metadata || !metadata.lines.some((line) => line.costCenterId)) return this.ledger.post(input);

    const lines = input.lines.map((line) => ({ ...line }));
    let cursor = 0;
    for (const source of metadata.lines) {
      if (!source.costCenterId) continue;
      const relative = lines.slice(cursor).findIndex(
        (line) => line.accountId === source.accountId && !line.partyId,
      );
      if (relative < 0) continue;
      const index = cursor + relative;
      lines[index] = { ...lines[index]!, costCenterId: source.costCenterId };
      cursor = index + 1;
    }
    return this.ledger.post({ ...input, lines });
  }

  reverse(...args: ReverseArgs) {
    return this.ledger.reverse(...args);
  }
}
