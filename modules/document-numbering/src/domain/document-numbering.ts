export type NumberResetPeriod='YEARLY'|'NEVER';
export interface NumberingPolicy{
 readonly id:string;readonly companyId:string;readonly documentType:string;readonly branchId:string|null;
 readonly prefixTemplate:string;readonly padding:number;readonly resetPeriod:NumberResetPeriod;readonly active:boolean;
 readonly createdAt:string;readonly updatedAt:string;
}
export interface AllocatedDocumentNumber{
 readonly policyId:string;readonly documentType:string;readonly branchId:string|null;readonly periodKey:string;
 readonly sequence:number;readonly value:string;
}
