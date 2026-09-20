import { ContractValidationError, type BranchId, type CompanyId } from '@elhafez/contracts';

declare const leadIdBrand:unique symbol;
export type LeadId=string&{readonly[leadIdBrand]:'LeadId'};
export type LeadStatus='NEW'|'CONTACTED'|'QUALIFIED'|'QUOTED'|'WON'|'LOST';
export interface Lead {
 readonly id:LeadId; readonly companyId:CompanyId; readonly branchId:BranchId; readonly number:string;
 readonly partyKind:'PERSON'|'ORGANIZATION'; readonly displayName:string; readonly legalName:string|null;
 readonly phone:string|null; readonly whatsappNumber:string|null; readonly email:string|null; readonly address:string|null;
 readonly nationalIdentity:string|null; readonly taxIdentity:string|null;
 readonly source:string; readonly requestedService:string|null; readonly expectedValue:string|null; readonly currency:string|null;
 readonly status:LeadStatus; readonly responsibleUserId:string|null; readonly referralAgentId:string|null; readonly notes:string|null;
 readonly lostReason:string|null; readonly preLostStatus:Exclude<LeadStatus,'LOST'>|null; readonly quotationReference:string|null;
 readonly convertedCustomerId:string|null; readonly createdAt:string; readonly updatedAt:string;
}
export type LeadHistoryKind='CREATED'|'UPDATED'|'STATUS_CHANGED'|'LOST'|'REOPENED'|'QUOTED'|'CONVERTED';
export interface LeadHistory { readonly id:string; readonly companyId:CompanyId; readonly branchId:BranchId; readonly leadId:LeadId; readonly kind:LeadHistoryKind; readonly fromStatus:LeadStatus|null; readonly toStatus:LeadStatus|null; readonly detail:string|null; readonly actorId:string; readonly occurredAt:string; }
export interface CreateLeadInput {
 readonly partyKind:'PERSON'|'ORGANIZATION'; readonly displayName:string; readonly legalName?:string; readonly phone?:string; readonly whatsappNumber?:string; readonly email?:string; readonly address?:string; readonly nationalIdentity?:string; readonly taxIdentity?:string;
 readonly source:string; readonly requestedService?:string; readonly expectedValue?:string; readonly currency?:string; readonly responsibleUserId?:string; readonly referralAgentId?:string; readonly notes?:string;
}
export interface UpdateLeadInput { readonly displayName?:string; readonly legalName?:string|null; readonly phone?:string|null; readonly whatsappNumber?:string|null; readonly email?:string|null; readonly address?:string|null; readonly source?:string; readonly requestedService?:string|null; readonly expectedValue?:string|null; readonly currency?:string|null; readonly responsibleUserId?:string|null; readonly referralAgentId?:string|null; readonly notes?:string|null; }
export const leadId=(value:string):LeadId=>{const x=value.trim();if(!x)throw new ContractValidationError('leadId','is required');return x as LeadId;};
export const requiredText=(value:string,field:string):string=>{const x=value.trim().replace(/\s+/g,' ');if(!x)throw new ContractValidationError(field,'is required');return x;};
export function optionalText(value:string|undefined|null):string|null{return value?.trim()||null;}
export function exactDecimal(value:string|undefined|null):string|null{if(value==null||!value.trim())return null;const x=value.trim();if(!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(x))throw new ContractValidationError('expectedValue','must be a non-negative decimal with up to 6 decimals');return x;}
export function currencyCode(value:string|undefined|null,amount:string|null):string|null{if(!amount)return null;const x=value?.trim().toUpperCase();if(!x||!/^[A-Z]{3}$/.test(x))throw new ContractValidationError('currency','must be a three-letter code when expected value is set');return x;}
