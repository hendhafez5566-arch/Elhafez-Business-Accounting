import type { CompanyId } from '@elhafez/contracts';
import type { ReportingProjectionRepository } from '../application/reporting-projection.repository.js';
import type { ReportingEvidence } from '../domain/reporting.js';

export class InMemoryReportingProjectionRepository implements ReportingProjectionRepository {
  private readonly companies = new Map<CompanyId, Map<string, ReportingEvidence>>();
  async find(companyId: CompanyId, evidenceId: string) { return this.companies.get(companyId)?.get(evidenceId); }
  async save(evidence: ReportingEvidence) {
    let company = this.companies.get(evidence.companyId);
    if (!company) { company = new Map(); this.companies.set(evidence.companyId, company); }
    company.set(evidence.evidenceId, evidence);
  }
  async list(companyId: CompanyId) { return [...(this.companies.get(companyId)?.values() ?? [])]; }
  async replaceCompany(companyId: CompanyId, evidence: readonly ReportingEvidence[]) {
    this.companies.set(companyId, new Map(evidence.map((item) => [item.evidenceId, item])));
  }
}
