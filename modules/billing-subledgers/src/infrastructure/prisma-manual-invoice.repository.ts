import type { PrismaClient } from '@prisma/client';
import { ContractValidationError, type CompanyId } from '@elhafez/contracts';
import type {
  ManualInvoiceDraftCore,
  ManualInvoiceMetadata,
  ManualInvoiceRepository,
} from '../application/manual-invoice.repository.js';

type WorkflowRow = { payload: unknown };

export class PrismaManualInvoiceRepository implements ManualInvoiceRepository {
  constructor(private readonly db: PrismaClient) {}

  async metadata(companyId: CompanyId, invoiceId: string): Promise<ManualInvoiceMetadata | undefined> {
    const rows = await this.db.$queryRaw<WorkflowRow[]>`
      SELECT payload
      FROM billing_invoice_manual_workflows
      WHERE company_id = ${companyId} AND invoice_id = ${invoiceId}
      LIMIT 1
    `;
    const raw = rows[0]?.payload;
    if (!raw || typeof raw !== 'object') return undefined;
    return raw as ManualInvoiceMetadata;
  }

  async saveMetadata(value: ManualInvoiceMetadata): Promise<void> {
    const payload = JSON.stringify(value);
    await this.db.$executeRaw`
      INSERT INTO billing_invoice_manual_workflows (company_id, invoice_id, payload, updated_at)
      VALUES (${value.companyId}, ${value.invoiceId}, CAST(${payload} AS jsonb), CURRENT_TIMESTAMP)
      ON CONFLICT (company_id, invoice_id)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = CURRENT_TIMESTAMP
    `;
  }

  async replaceDraft(value: ManualInvoiceDraftCore): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const changed = await tx.$executeRaw`
        UPDATE billing_invoices
        SET party_id = ${value.partyId},
            number = ${value.number},
            posting_date = CAST(${value.postingDate} AS date),
            due_date = ${value.dueDate ?? null}::date,
            currency = ${value.currency},
            control_account_id = ${value.controlAccountId},
            request_hash = ${value.requestHash}
        WHERE company_id = ${value.companyId}
          AND id = ${value.invoiceId}
          AND status = 'DRAFT'
      `;
      if (changed !== 1) throw new ContractValidationError('invoice', 'editable draft not found');

      await tx.$executeRaw`
        DELETE FROM billing_invoice_lines
        WHERE company_id = ${value.companyId} AND invoice_id = ${value.invoiceId}
      `;
      for (const line of value.lines) {
        await tx.$executeRaw`
          INSERT INTO billing_invoice_lines
            (id, company_id, invoice_id, account_id, amount, tax_code)
          VALUES
            (${line.id}, ${value.companyId}, ${value.invoiceId}, ${line.accountId},
             CAST(${line.amount} AS decimal(38,18)), ${line.taxCode ?? null})
        `;
      }
    }, { isolationLevel: 'Serializable' });
  }

  async cancelDraft(companyId: CompanyId, invoiceId: string): Promise<void> {
    const changed = await this.db.$executeRaw`
      UPDATE billing_invoices
      SET status = 'CANCELLED', outstanding = 0
      WHERE company_id = ${companyId} AND id = ${invoiceId} AND status = 'DRAFT'
    `;
    if (changed !== 1) throw new ContractValidationError('invoice', 'draft invoice not found');
  }
}
