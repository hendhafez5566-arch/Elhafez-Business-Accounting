import { ContractValidationError, type CompanyId, type SourceReference } from '@elhafez/contracts';
import type { TourismFinanceRepository } from './orchestration.repository.js';

export class TourismFinanceReadApplicationService {
  constructor(private readonly repo: TourismFinanceRepository) {}

  async standaloneServiceFinancialView(companyId: CompanyId, branchId: string, service: SourceReference) {
    const reference = await this.repo.standalone(companyId, service);
    if (!reference) return { reference: null, snapshot: null };
    if (reference.branchId !== branchId) throw new ContractValidationError('service', 'financial reference is outside branch');
    const snapshot = await this.repo.latestSnapshot(companyId, service);
    return {
      reference: {
        status: reference.status,
        revision: reference.revision,
        debtorPartyId: reference.debtorPartyId,
        invoiceId: reference.invoiceId,
        allocationIds: reference.allocationIds,
        purchaseOrderIds: reference.purchaseOrderIds,
        commissionClaimId: reference.commissionClaimId,
      },
      snapshot: snapshot ? {
        id: snapshot.id,
        version: snapshot.version,
        category: snapshot.category,
        currency: snapshot.currency,
        saleAmount: snapshot.saleAmount,
        costAmount: snapshot.costAmount,
        status: snapshot.status,
        supersedesId: snapshot.supersedesId,
        evidence: snapshot.evidence,
        createdAt: snapshot.createdAt,
      } : null,
    };
  }
}

export type StandaloneServiceFinancialView = Awaited<ReturnType<TourismFinanceReadApplicationService['standaloneServiceFinancialView']>>;
