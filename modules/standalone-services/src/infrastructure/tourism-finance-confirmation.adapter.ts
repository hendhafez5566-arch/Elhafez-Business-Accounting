import { sourceReference } from '@elhafez/contracts';
import type { TourismFinanceOrchestrationApplicationService } from '@elhafez/tourism-finance-orchestration';
import type { ConfirmationPort } from '../application/standalone-services.application-service.js';

export class TourismFinanceConfirmationAdapter implements ConfirmationPort {
  constructor(private readonly finance: TourismFinanceOrchestrationApplicationService) {}
  prepare(input: Parameters<ConfirmationPort['prepare']>[0]) {
    return this.finance.prepareStandaloneService({ companyId: input.companyId, branchId: input.branchId,
      service: sourceReference('TOURISM_SERVICE', input.serviceId), revision: input.revision,
      planId: input.planId, planVersion: input.planVersion });
  }
  async commit(input: Parameters<ConfirmationPort['commit']>[0]) {
    const version = input.revisionSnapshot;
    const result = await this.finance.confirmStandaloneService({
      companyId: input.companyId, branchId: input.branchId, commandKey: input.commandKey,
      service: sourceReference('TOURISM_SERVICE', input.serviceId), revision: input.revision,
      category: version.category, debtorPartyId: version.debtorPartyId,
      currency: version.commercial.currency, grossAmount: version.commercial.grossAmount,
      discountAmount: version.commercial.discountAmount,
      postingDate: version.financialTerms.postingDate, dueDate: version.financialTerms.dueDate,
      invoiceNumber: version.financialTerms.invoiceNumber,
      ...(version.financialTerms.approvalRequestId ? { approvalRequestId: version.financialTerms.approvalRequestId } : {}),
      ...(version.financialTerms.commission ? { commission: version.financialTerms.commission } : {}),
      planId: input.planId, planVersion: input.planVersion,
    });
    return { operationId: result.confirmationWorkflowId };
  }
  async cancel(): Promise<{ cancelled: boolean; blockers: readonly string[] }> {
    return { cancelled: false, blockers: ['FULFILLMENT_AND_FINANCIAL_REVERSAL_NOT_CONNECTED'] };
  }
}
