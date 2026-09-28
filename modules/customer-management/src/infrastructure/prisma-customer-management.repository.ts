import type { PrismaClient } from '@prisma/client';
import type { CompanyId } from '@elhafez/contracts';
import type { CustomerManagementRepository } from '../application/customer-management.repository.js';
import { customerId, type Customer, type CustomerCommercialProfile, type CustomerId, type CustomerReference } from '../domain/customer.js';

export class PrismaCustomerManagementRepository implements CustomerManagementRepository {
  constructor(private readonly db:PrismaClient){}
  async nextNumber(c:CompanyId){const r=await this.db.cmNumberCounter.upsert({where:{companyId:c},create:{companyId:c,nextValue:1},update:{nextValue:{increment:1}}});return r.nextValue;}
  async create(v:Customer){await this.db.cmCustomer.create({data:{id:v.id,companyId:v.companyId,partyId:v.partyId,number:v.number,status:v.status,assignedAgentId:v.assignedAgentId,commercialNotes:v.commercialNotes,createdAt:new Date(v.createdAt),updatedAt:new Date(v.updatedAt)}});}
  async update(v:Customer){await this.db.cmCustomer.update({where:{companyId_id:{companyId:v.companyId,id:v.id}},data:{status:v.status,assignedAgentId:v.assignedAgentId,commercialNotes:v.commercialNotes,updatedAt:new Date(v.updatedAt)}});}
  async find(c:CompanyId,i:CustomerId){const r=await this.db.cmCustomer.findUnique({where:{companyId_id:{companyId:c,id:i}}});return r?map(r):undefined;}
  async findByParty(c:CompanyId,p:string){const r=await this.db.cmCustomer.findUnique({where:{companyId_partyId:{companyId:c,partyId:p}}});return r?map(r):undefined;}
  async list(c:CompanyId,s?:Customer['status'],q?:string,partyIds:readonly string[]=[]){
    const rows=await this.db.cmCustomer.findMany({
      where:{
        companyId:c,
        ...(s?{status:s}:{}),
        ...(q?{OR:[
          {number:{contains:q,mode:'insensitive' as const}},
          {commercialNotes:{contains:q,mode:'insensitive' as const}},
          ...(partyIds.length?[{partyId:{in:[...partyIds]}}]:[]),
        ]}:{}),
      },
      orderBy:{createdAt:'desc'},
    });
    return rows.map(map);
  }
  async delete(c:CompanyId,i:CustomerId){await this.db.cmCustomer.delete({where:{companyId_id:{companyId:c,id:i}}});}
  async addReference(v:CustomerReference){await this.db.cmCustomerReference.upsert({where:{companyId_customerId_sourceType_sourceId:{companyId:v.companyId,customerId:v.customerId,sourceType:v.sourceType,sourceId:v.sourceId}},create:{companyId:v.companyId,customerId:v.customerId,sourceType:v.sourceType,sourceId:v.sourceId,createdAt:new Date(v.createdAt)},update:{}});}
  async removeReference(c:CompanyId,i:CustomerId,t:string,s:string){await this.db.cmCustomerReference.deleteMany({where:{companyId:c,customerId:i,sourceType:t,sourceId:s}});}
  async referenceCount(c:CompanyId,i:CustomerId){return this.db.cmCustomerReference.count({where:{companyId:c,customerId:i}});}
  async commercialProfile(c:CompanyId,i:CustomerId){const r=await this.db.cmCustomerCommercialProfile.findUnique({where:{companyId_customerId:{companyId:c,customerId:i}}});return r?{companyId:r.companyId as CompanyId,customerId:customerId(r.customerId),groupCode:r.groupCode,loyaltyTier:r.loyaltyTier,loyaltyPoints:r.loyaltyPoints,tags:Array.isArray(r.tags)?r.tags.filter((x:unknown):x is string=>typeof x==='string'):[],creditNotes:r.creditNotes,updatedAt:r.updatedAt.toISOString()}:undefined;}
  async saveCommercialProfile(v:CustomerCommercialProfile){const r=await this.db.cmCustomerCommercialProfile.upsert({where:{companyId_customerId:{companyId:v.companyId,customerId:v.customerId}},create:{companyId:v.companyId,customerId:v.customerId,groupCode:v.groupCode,loyaltyTier:v.loyaltyTier,loyaltyPoints:v.loyaltyPoints,tags:[...v.tags],creditNotes:v.creditNotes,updatedAt:new Date(v.updatedAt)},update:{groupCode:v.groupCode,loyaltyTier:v.loyaltyTier,loyaltyPoints:v.loyaltyPoints,tags:[...v.tags],creditNotes:v.creditNotes,updatedAt:new Date(v.updatedAt)}});return{companyId:r.companyId as CompanyId,customerId:customerId(r.customerId),groupCode:r.groupCode,loyaltyTier:r.loyaltyTier,loyaltyPoints:r.loyaltyPoints,tags:Array.isArray(r.tags)?r.tags.filter((x:unknown):x is string=>typeof x==='string'):[],creditNotes:r.creditNotes,updatedAt:r.updatedAt.toISOString()};}
}
function map(r:{id:string;companyId:string;partyId:string;number:string;status:string;assignedAgentId:string|null;commercialNotes:string|null;createdAt:Date;updatedAt:Date}):Customer{return{id:customerId(r.id),companyId:r.companyId as CompanyId,partyId:r.partyId,number:r.number,status:r.status as Customer['status'],assignedAgentId:r.assignedAgentId,commercialNotes:r.commercialNotes,createdAt:r.createdAt.toISOString(),updatedAt:r.updatedAt.toISOString()};}
