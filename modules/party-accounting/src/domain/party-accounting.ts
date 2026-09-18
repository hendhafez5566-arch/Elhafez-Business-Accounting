import type { CompanyId, DecimalAmount } from '@elhafez/contracts';
export type PartyRole='CUSTOMER'|'SUPPLIER'|'AGENT';
export interface PartyGroupMember {id:string;companyId:CompanyId;groupId:string;role:PartyRole;partyId:string}
export interface PartyGroup {id:string;companyId:CompanyId;name:string;status:'ACTIVE';members:PartyGroupMember[]}
export type NettingStatus='DRAFT'|'POSTING'|'POSTED'|'REVERSING'|'REVERSED';
export interface NettingDocument {id:string;companyId:CompanyId;groupId:string;customerInvoiceId:string;supplierInvoiceId:string;amount:DecimalAmount;postingDate:string;number:string;status:NettingStatus;requestHash:string;customerAllocationId?:string;supplierAllocationId?:string;journalId?:string;reversalJournalId?:string;reversedAt?:string}
