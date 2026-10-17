import type{AllocatedDocumentNumber,NumberingPolicy,NumberResetPeriod}from'../domain/document-numbering.js';
export interface CreateNumberingPolicyRecord{readonly id:string;readonly companyId:string;readonly documentType:string;readonly branchScope:string;readonly prefixTemplate:string;readonly padding:number;readonly resetPeriod:NumberResetPeriod;readonly active:boolean;readonly createdAt:string;readonly updatedAt:string}
export interface UpdateNumberingPolicyRecord{readonly prefixTemplate:string;readonly padding:number;readonly resetPeriod:NumberResetPeriod;readonly active:boolean;readonly updatedAt:string}
export interface StoredNumberAllocation{readonly requestHash:string;readonly number:AllocatedDocumentNumber;}
export interface NumberAllocationRequest{readonly companyId:string;readonly requestId:string;readonly requestHash:string;readonly policy:NumberingPolicy;readonly periodKey:string;readonly year:string;}
export interface DocumentNumberingRepository{
 findAllocation(companyId:string,requestId:string):Promise<StoredNumberAllocation|undefined>;
 allocateOnce(input:NumberAllocationRequest):Promise<StoredNumberAllocation>;
 createPolicy(input:CreateNumberingPolicyRecord):Promise<NumberingPolicy>;
 updatePolicy(companyId:string,id:string,input:UpdateNumberingPolicyRecord):Promise<NumberingPolicy>;
 findPolicy(companyId:string,id:string):Promise<NumberingPolicy|undefined>;
 listPolicies(companyId:string,documentType?:string):Promise<readonly NumberingPolicy[]>;
 findActivePolicy(companyId:string,documentType:string,branchId:string|null):Promise<NumberingPolicy|undefined>;
 allocateNext(companyId:string,policyId:string,periodKey:string):Promise<number>;
}
export const DOCUMENT_NUMBERING_REPOSITORY=Symbol('DOCUMENT_NUMBERING_REPOSITORY');
