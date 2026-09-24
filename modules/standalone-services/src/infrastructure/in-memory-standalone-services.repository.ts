import type { CompanyId } from '@elhafez/contracts';
import type { StandaloneServicesRepository } from '../application/standalone-services.repository.js';
import type { CommandReceipt, ServiceHistoryEntry, ServiceRevision, ServiceType, StandaloneService } from '../domain/service.js';

export class InMemoryStandaloneServicesRepository implements StandaloneServicesRepository {
  private readonly types=new Map<string,ServiceType>(); private readonly services=new Map<string,StandaloneService>(); private readonly revisions=new Map<string,ServiceRevision>(); private readonly histories=new Map<string,ServiceHistoryEntry[]>(); private readonly receipts=new Map<string,CommandReceipt>();
  private key(companyId:CompanyId,id:string){return `${companyId}:${id}`;}
  async getType(companyId:CompanyId,id:string){return this.types.get(this.key(companyId,id))??null;} async saveType(v:ServiceType){this.types.set(this.key(v.companyId,v.id),v);}
  async getService(companyId:CompanyId,id:string){return this.services.get(this.key(companyId,id))??null;} async getByNumber(companyId:CompanyId,branchId:string,number:string){return [...this.services.values()].find(v=>v.companyId===companyId&&v.branchId===branchId&&v.number===number)??null;} async saveService(v:StandaloneService){this.services.set(this.key(v.companyId,v.id),v);}
  async getRevision(serviceId:string,revision:number){return this.revisions.get(`${serviceId}:${revision}`)??null;} async saveRevision(v:ServiceRevision){this.revisions.set(`${v.serviceId}:${v.revision}`,v);}
  async appendHistory(v:ServiceHistoryEntry){this.histories.set(v.serviceId,[...(this.histories.get(v.serviceId)??[]),v]);} async history(serviceId:string){return this.histories.get(serviceId)??[];}
  async getReceipt(companyId:CompanyId,commandKey:string){return this.receipts.get(this.key(companyId,commandKey))??null;} async saveReceipt(v:CommandReceipt){this.receipts.set(this.key(v.companyId,v.commandKey),v);}
}
