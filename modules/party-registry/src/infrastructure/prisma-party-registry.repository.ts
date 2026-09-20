import type { PrismaClient } from '@prisma/client';
import type { CompanyId } from '@elhafez/contracts';
import type { PartyRegistryRepository } from '../application/party-registry.repository.js';
import { partyId, type Party, type PartyId, type PartyRole, type PartyRoleLink } from '../domain/party.js';

export class PrismaPartyRegistryRepository implements PartyRegistryRepository {
  constructor(private readonly db:PrismaClient){}
  async create(value:Party):Promise<void>{
    await this.db.prParty.create({data:{...this.toData(value)}});
  }
  async update(value:Party):Promise<void>{
    await this.db.prParty.update({where:{companyId_id:{companyId:value.companyId,id:value.id}},data:{...this.toData(value)}});
  }
  async find(companyId:CompanyId,id:PartyId):Promise<Party|undefined>{
    const row=await this.db.prParty.findUnique({where:{companyId_id:{companyId,id}}}); return row?this.map(row):undefined;
  }
  async list(companyId:CompanyId,query?:string):Promise<Party[]>{
    const rows=await this.db.prParty.findMany({where:{companyId,...(query?{OR:[
      {displayName:{contains:query,mode:'insensitive'}},{legalName:{contains:query,mode:'insensitive'}},{phone:{contains:query}},{email:{contains:query,mode:'insensitive'}}
    ]}:{})},orderBy:{createdAt:'desc'}}); return rows.map((row)=>this.map(row));
  }
  async findCandidates(companyId:CompanyId,e:{nationalIdentityNormalized:string|null;taxIdentityNormalized:string|null;phoneNormalized:string|null;emailNormalized:string|null}):Promise<Party[]>{
    const or:Record<string,string>[]=[];
    if(e.nationalIdentityNormalized) or.push({nationalIdentityNormalized:e.nationalIdentityNormalized});
    if(e.taxIdentityNormalized) or.push({taxIdentityNormalized:e.taxIdentityNormalized});
    if(e.phoneNormalized) or.push({phoneNormalized:e.phoneNormalized});
    if(e.emailNormalized) or.push({emailNormalized:e.emailNormalized});
    if(or.length===0) return [];
    const rows=await this.db.prParty.findMany({where:{companyId,OR:or}}); return rows.map((row)=>this.map(row));
  }
  async ensureRole(value:PartyRoleLink):Promise<void>{
    await this.db.prPartyRole.upsert({where:{companyId_partyId_role:{companyId:value.companyId,partyId:value.partyId,role:value.role}},create:{companyId:value.companyId,partyId:value.partyId,role:value.role,createdAt:new Date(value.createdAt)},update:{}});
  }
  async removeRole(companyId:CompanyId,partyIdValue:PartyId,role:PartyRole):Promise<void>{
    await this.db.prPartyRole.deleteMany({where:{companyId,partyId:partyIdValue,role}});
  }
  async roles(companyId:CompanyId,partyIdValue:PartyId):Promise<PartyRoleLink[]>{
    return (await this.db.prPartyRole.findMany({where:{companyId,partyId:partyIdValue}})).map((row)=>({companyId:row.companyId as CompanyId,partyId:partyId(row.partyId),role:row.role as PartyRole,createdAt:row.createdAt.toISOString()}));
  }
  private toData(value:Party){
    return {id:value.id,companyId:value.companyId,kind:value.kind,displayName:value.displayName,legalName:value.legalName,phone:value.phone,phoneNormalized:value.phoneNormalized,whatsappNumber:value.whatsappNumber,whatsappNormalized:value.whatsappNormalized,email:value.email,emailNormalized:value.emailNormalized,address:value.address,nationalIdentity:value.nationalIdentity,nationalIdentityNormalized:value.nationalIdentityNormalized,taxIdentity:value.taxIdentity,taxIdentityNormalized:value.taxIdentityNormalized,status:value.status,createdAt:new Date(value.createdAt),updatedAt:new Date(value.updatedAt)};
  }
  private map(row:{id:string;companyId:string;kind:string;displayName:string;legalName:string|null;phone:string|null;phoneNormalized:string|null;whatsappNumber:string|null;whatsappNormalized:string|null;email:string|null;emailNormalized:string|null;address:string|null;nationalIdentity:string|null;nationalIdentityNormalized:string|null;taxIdentity:string|null;taxIdentityNormalized:string|null;status:string;createdAt:Date;updatedAt:Date}):Party{
    return {id:partyId(row.id),companyId:row.companyId as CompanyId,kind:row.kind as Party['kind'],displayName:row.displayName,legalName:row.legalName,phone:row.phone,phoneNormalized:row.phoneNormalized,whatsappNumber:row.whatsappNumber,whatsappNormalized:row.whatsappNormalized,email:row.email,emailNormalized:row.emailNormalized,address:row.address,nationalIdentity:row.nationalIdentity,nationalIdentityNormalized:row.nationalIdentityNormalized,taxIdentity:row.taxIdentity,taxIdentityNormalized:row.taxIdentityNormalized,status:row.status as Party['status'],createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString()};
  }
}
