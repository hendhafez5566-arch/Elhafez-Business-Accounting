import type { CompanyId } from '@elhafez/contracts';
import type { CommandReceipt, ServiceHistoryEntry, ServiceRevision, ServiceType, StandaloneService } from '../domain/service.js';

export interface StandaloneServicesRepository {
  getType(companyId: CompanyId, id: string): Promise<ServiceType | null>;
  saveType(value: ServiceType): Promise<void>;
  getService(companyId: CompanyId, id: string): Promise<StandaloneService | null>;
  getByNumber(companyId: CompanyId, branchId: string, number: string): Promise<StandaloneService | null>;
  saveService(value: StandaloneService): Promise<void>;
  getRevision(serviceId: string, revision: number): Promise<ServiceRevision | null>;
  saveRevision(value: ServiceRevision): Promise<void>;
  appendHistory(value: ServiceHistoryEntry): Promise<void>;
  history(serviceId: string): Promise<readonly ServiceHistoryEntry[]>;
  getReceipt(companyId: CompanyId, commandKey: string): Promise<CommandReceipt | null>;
  saveReceipt(value: CommandReceipt): Promise<void>;
}
