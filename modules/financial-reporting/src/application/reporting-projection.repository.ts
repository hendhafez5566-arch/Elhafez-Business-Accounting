import type { CompanyId } from '@elhafez/contracts';
import type { ReportingEvidence } from '../domain/reporting.js';

export interface ReportingProjectionRepository {
  find(companyId: CompanyId, evidenceId: string): Promise<ReportingEvidence | undefined>;
  save(evidence: ReportingEvidence): Promise<void>;
  list(companyId: CompanyId): Promise<readonly ReportingEvidence[]>;
  replaceCompany(companyId: CompanyId, evidence: readonly ReportingEvidence[]): Promise<void>;
}
