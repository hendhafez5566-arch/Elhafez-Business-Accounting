import type { CompanyId } from '@elhafez/contracts';
import type { CommandReceipt, ServiceHistoryEntry, ServiceRevision, ServiceType, StandaloneService, StandaloneServiceStatus } from '../domain/service.js';

export interface StandaloneServicesRepository {
  getType(companyId: CompanyId, id: string): Promise<ServiceType | null>;
  listTypes(companyId: CompanyId): Promise<readonly ServiceType[]>;
  saveType(value: ServiceType): Promise<void>;
  getService(companyId: CompanyId, id: string): Promise<StandaloneService | null>;
  listServices(companyId: CompanyId, branchId: string): Promise<readonly StandaloneService[]>;
  getByNumber(companyId: CompanyId, branchId: string, number: string): Promise<StandaloneService | null>;
  getRevision(serviceId: string, revision: number): Promise<ServiceRevision | null>;
  history(serviceId: string): Promise<readonly ServiceHistoryEntry[]>;
  getReceipt(companyId: CompanyId, commandKey: string): Promise<CommandReceipt | null>;
  createDraft(service: StandaloneService, revision: ServiceRevision, history: ServiceHistoryEntry, receipt: CommandReceipt): Promise<void>;
  amendDraft(service: StandaloneService, expectedRevision: number, revision: ServiceRevision, history: ServiceHistoryEntry, receipt: CommandReceipt): Promise<void>;
  transition(service: StandaloneService, expectedStatus: StandaloneServiceStatus, history: ServiceHistoryEntry, receipt?: CommandReceipt): Promise<void>;
}
