import type { CompanyId } from '@elhafez/contracts';
import type { StandaloneServicesRepository } from '../application/standalone-services.repository.js';
import type { CommandReceipt, ServiceHistoryEntry, ServiceRevision, ServiceType, StandaloneService, StandaloneServiceStatus } from '../domain/service.js';

/** Test adapter. Production composition uses PrismaStandaloneServicesRepository. */
export class InMemoryStandaloneServicesRepository implements StandaloneServicesRepository {
  private readonly types = new Map<string, ServiceType>();
  private readonly services = new Map<string, StandaloneService>();
  private readonly revisions = new Map<string, ServiceRevision>();
  private readonly histories = new Map<string, ServiceHistoryEntry[]>();
  private readonly receipts = new Map<string, CommandReceipt>();
  private key(companyId: CompanyId, id: string) { return `${companyId}:${id}`; }
  async getType(companyId: CompanyId, id: string) { return this.types.get(this.key(companyId, id)) ?? null; }
  async listTypes(companyId: CompanyId) { return [...this.types.values()].filter(value => value.companyId === companyId).sort((a,b) => a.code.localeCompare(b.code)); }
  async saveType(value: ServiceType) { this.types.set(this.key(value.companyId, value.id), value); }
  async getService(companyId: CompanyId, id: string) { return this.services.get(this.key(companyId, id)) ?? null; }
  async listServices(companyId: CompanyId, branchId: string) { return [...this.services.values()].filter(value => value.companyId === companyId && value.branchId === branchId).sort((a,b) => b.createdAt.localeCompare(a.createdAt)); }
  async getByNumber(companyId: CompanyId, branchId: string, number: string) { return [...this.services.values()].find(value => value.companyId === companyId && value.branchId === branchId && value.number === number) ?? null; }
  async getRevision(serviceId: string, revision: number) { return this.revisions.get(`${serviceId}:${revision}`) ?? null; }
  async history(serviceId: string) { return this.histories.get(serviceId) ?? []; }
  async getReceipt(companyId: CompanyId, commandKey: string) { return this.receipts.get(this.key(companyId, commandKey)) ?? null; }
  async createDraft(service: StandaloneService, revision: ServiceRevision, history: ServiceHistoryEntry, receipt: CommandReceipt) {
    if (await this.getService(service.companyId, service.id) || await this.getByNumber(service.companyId, service.branchId, service.number)) throw new Error('service already exists');
    this.services.set(this.key(service.companyId, service.id), service);
    this.revisions.set(`${service.id}:${revision.revision}`, revision);
    this.histories.set(service.id, [history]);
    this.receipts.set(this.key(receipt.companyId, receipt.commandKey), receipt);
  }
  async amendDraft(service: StandaloneService, expectedRevision: number, revision: ServiceRevision, history: ServiceHistoryEntry, receipt: CommandReceipt) {
    const old = await this.getService(service.companyId, service.id);
    if (!old || old.status !== 'DRAFT' || old.revision !== expectedRevision) throw new Error('stale draft revision');
    this.services.set(this.key(service.companyId, service.id), service);
    this.revisions.set(`${service.id}:${revision.revision}`, revision);
    this.histories.set(service.id, [...(this.histories.get(service.id) ?? []), history]);
    this.receipts.set(this.key(receipt.companyId, receipt.commandKey), receipt);
  }
  async transition(service: StandaloneService, expectedStatus: StandaloneServiceStatus, history: ServiceHistoryEntry, receipt?: CommandReceipt) {
    const old = await this.getService(service.companyId, service.id);
    if (!old || old.status !== expectedStatus || old.revision !== service.revision) throw new Error('stale service status');
    this.services.set(this.key(service.companyId, service.id), service);
    this.histories.set(service.id, [...(this.histories.get(service.id) ?? []), history]);
    if (receipt) this.receipts.set(this.key(receipt.companyId, receipt.commandKey), receipt);
  }
}
