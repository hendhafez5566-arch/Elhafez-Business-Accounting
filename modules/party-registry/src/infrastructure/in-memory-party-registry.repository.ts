import type { CompanyId } from '@elhafez/contracts';
import type { PartyRegistryRepository } from '../application/party-registry.repository.js';
import type { Party, PartyId, PartyRole, PartyRoleLink } from '../domain/party.js';
export class InMemoryPartyRegistryRepository implements PartyRegistryRepository {
  private readonly parties=new Map<string,Party>();
  private readonly roleRows=new Map<string,PartyRoleLink>();
  private key(companyId:CompanyId,id:PartyId):string{return companyId+'|'+id;}
  async create(value:Party):Promise<void>{
    for (const existing of this.parties.values()){
      if(existing.companyId!==value.companyId) continue;
      if(value.nationalIdentityNormalized && existing.nationalIdentityNormalized===value.nationalIdentityNormalized) throw new Error('duplicate national identity');
      if(value.taxIdentityNormalized && existing.taxIdentityNormalized===value.taxIdentityNormalized) throw new Error('duplicate tax identity');
    }
    if(this.parties.has(this.key(value.companyId,value.id))) throw new Error('duplicate party');
    this.parties.set(this.key(value.companyId,value.id),value);
  }
  async update(value:Party):Promise<void>{ if(!this.parties.has(this.key(value.companyId,value.id))) throw new Error('party missing'); this.parties.set(this.key(value.companyId,value.id),value); }
  async find(companyId:CompanyId,id:PartyId):Promise<Party|undefined>{return this.parties.get(this.key(companyId,id));}
  async list(companyId:CompanyId,query?:string):Promise<Party[]>{const q=query?.toLowerCase();return [...this.parties.values()].filter((p)=>p.companyId===companyId&&(!q||[p.displayName,p.legalName,p.phone,p.email].some((v)=>v?.toLowerCase().includes(q))));}
  async findCandidates(companyId:CompanyId,e:{nationalIdentityNormalized:string|null;taxIdentityNormalized:string|null;phoneNormalized:string|null;emailNormalized:string|null}):Promise<Party[]>{
    return [...this.parties.values()].filter((p)=>p.companyId===companyId&&(
      (!!e.nationalIdentityNormalized&&p.nationalIdentityNormalized===e.nationalIdentityNormalized)||
      (!!e.taxIdentityNormalized&&p.taxIdentityNormalized===e.taxIdentityNormalized)||
      (!!e.phoneNormalized&&p.phoneNormalized===e.phoneNormalized)||
      (!!e.emailNormalized&&p.emailNormalized===e.emailNormalized)
    ));
  }
  async ensureRole(value:PartyRoleLink):Promise<void>{this.roleRows.set(value.companyId+'|'+value.partyId+'|'+value.role,value);}
  async removeRole(companyId:CompanyId,partyId:PartyId,role:PartyRole):Promise<void>{this.roleRows.delete(companyId+'|'+partyId+'|'+role);}
  async roles(companyId:CompanyId,partyId:PartyId):Promise<PartyRoleLink[]>{return [...this.roleRows.values()].filter((r)=>r.companyId===companyId&&r.partyId===partyId);}
}
