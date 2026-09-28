import type { CompanyId } from '@elhafez/contracts';
import type { Customer, CustomerCommercialProfile, CustomerId, CustomerReference } from '../domain/customer.js';

export interface CustomerManagementRepository {
  nextNumber(companyId:CompanyId):Promise<number>;
  create(value:Customer):Promise<void>;
  update(value:Customer):Promise<void>;
  find(companyId:CompanyId,id:CustomerId):Promise<Customer|undefined>;
  findByParty(companyId:CompanyId,partyId:string):Promise<Customer|undefined>;
  list(companyId:CompanyId,status?:Customer['status'],query?:string,partyIds?:readonly string[]):Promise<Customer[]>;
  delete(companyId:CompanyId,id:CustomerId):Promise<void>;
  addReference(value:CustomerReference):Promise<void>;
  removeReference(companyId:CompanyId,id:CustomerId,sourceType:string,sourceId:string):Promise<void>;
  referenceCount(companyId:CompanyId,id:CustomerId):Promise<number>;
  commercialProfile(companyId:CompanyId,id:CustomerId):Promise<CustomerCommercialProfile|undefined>;
  saveCommercialProfile(value:CustomerCommercialProfile):Promise<CustomerCommercialProfile>;
}
export const CUSTOMER_MANAGEMENT_REPOSITORY=Symbol('CUSTOMER_MANAGEMENT_REPOSITORY');
