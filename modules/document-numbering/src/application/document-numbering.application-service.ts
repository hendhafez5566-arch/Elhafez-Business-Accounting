import{randomUUID}from'node:crypto';
import{ContractValidationError}from'@elhafez/contracts';
import type{DocumentNumberingAccess}from'./document-numbering.access.js';
import type{DocumentNumberingRepository}from'./document-numbering.repository.js';
import type{AllocatedDocumentNumber,NumberResetPeriod}from'../domain/document-numbering.js';

export const DOCUMENT_NUMBERING_PERMISSIONS=Object.freeze({read:'platform.numbering.read',manage:'platform.numbering.manage',allocate:'platform.numbering.allocate'} as const);
export interface DocumentNumberingContext{readonly companyId:string;readonly actorId:string}
export interface CreateNumberingPolicyInput{readonly documentType:string;readonly branchId?:string|null;readonly prefixTemplate:string;readonly padding:number;readonly resetPeriod:NumberResetPeriod}
export interface UpdateNumberingPolicyInput{readonly prefixTemplate?:string;readonly padding?:number;readonly resetPeriod?:NumberResetPeriod;readonly active?:boolean}
export interface AllocateDocumentNumberInput{readonly documentType:string;readonly branchId?:string|null;readonly date?:string}

function required(value:string,field:string){const normalized=value.trim();if(!normalized)throw new ContractValidationError(field,'is required');return normalized;}
function documentType(value:string){const normalized=required(value,'documentType').normalize('NFKC').toUpperCase();if(!/^[A-Z0-9][A-Z0-9_.-]{0,63}$/.test(normalized))throw new ContractValidationError('documentType','must use 1-64 letters, numbers, dot, underscore or dash');return normalized;}
function prefix(value:string){const normalized=value.trim();if(normalized.length>80)throw new ContractValidationError('prefixTemplate','must not exceed 80 characters');const tokens=normalized.match(/\{[^}]+\}/g)??[];if(tokens.some(token=>token!=='{YYYY}'))throw new ContractValidationError('prefixTemplate','only {YYYY} is supported');return normalized;}
function padding(value:number){if(!Number.isInteger(value)||value<1||value>12)throw new ContractValidationError('padding','must be an integer from 1 to 12');return value;}
function reset(value:NumberResetPeriod){if(value!=='YEARLY'&&value!=='NEVER')throw new ContractValidationError('resetPeriod','must be YEARLY or NEVER');return value;}
function dateValue(value:string|undefined,now:Date){if(!value)return now;const parsed=new Date(value+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(parsed.getTime()))throw new ContractValidationError('date','must be an ISO date');return parsed;}
export class DocumentNumberingApplicationService{
 constructor(private readonly repo:DocumentNumberingRepository,private readonly access:DocumentNumberingAccess,private readonly now:()=>Date=()=>new Date(),private readonly newId:()=>string=()=>randomUUID()){}
 private async permission(context:DocumentNumberingContext,permission:string){if(!context.companyId||!context.actorId)throw new ContractValidationError('context','company and actor are required');await this.access.requirePermission(context,permission);}
 async createPolicy(context:DocumentNumberingContext,input:CreateNumberingPolicyInput){
  await this.permission(context,DOCUMENT_NUMBERING_PERMISSIONS.manage);const now=this.now().toISOString();
  const policy=await this.repo.createPolicy({id:this.newId(),companyId:context.companyId,documentType:documentType(input.documentType),branchScope:input.branchId?required(input.branchId,'branchId'):'*',prefixTemplate:prefix(input.prefixTemplate),padding:padding(input.padding),resetPeriod:reset(input.resetPeriod),active:true,createdAt:now,updatedAt:now});
  await this.access.auditOnce(context,'numbering.policy.created:'+policy.id,'numbering.policy.created',policy.id,{documentType:policy.documentType,branchId:policy.branchId});
  return policy;
 }
 async updatePolicy(context:DocumentNumberingContext,id:string,input:UpdateNumberingPolicyInput){
  await this.permission(context,DOCUMENT_NUMBERING_PERMISSIONS.manage);const current=await this.requirePolicy(context.companyId,id);
  const updated=await this.repo.updatePolicy(context.companyId,current.id,{prefixTemplate:input.prefixTemplate===undefined?current.prefixTemplate:prefix(input.prefixTemplate),padding:input.padding===undefined?current.padding:padding(input.padding),resetPeriod:input.resetPeriod===undefined?current.resetPeriod:reset(input.resetPeriod),active:input.active??current.active,updatedAt:this.now().toISOString()});
  await this.access.auditOnce(context,'numbering.policy.updated:'+updated.id+':'+updated.updatedAt,'numbering.policy.updated',updated.id,{active:updated.active});
  return updated;
 }
 async listPolicies(context:DocumentNumberingContext,type?:string){await this.permission(context,DOCUMENT_NUMBERING_PERMISSIONS.read);return this.repo.listPolicies(context.companyId,type?documentType(type):undefined);}
 async allocate(context:DocumentNumberingContext,input:AllocateDocumentNumberInput):Promise<AllocatedDocumentNumber>{
  await this.permission(context,DOCUMENT_NUMBERING_PERMISSIONS.allocate);const type=documentType(input.documentType),branch=input.branchId?.trim()||null;
  const policy=await this.repo.findActivePolicy(context.companyId,type,branch);if(!policy)throw new ContractValidationError('documentType','no active numbering policy is configured');
  const date=dateValue(input.date,this.now()),year=String(date.getUTCFullYear()),periodKey=policy.resetPeriod==='YEARLY'?year:'ALL',sequence=await this.repo.allocateNext(context.companyId,policy.id,periodKey);
  const value=policy.prefixTemplate.replaceAll('{YYYY}',year)+String(sequence).padStart(policy.padding,'0');
  await this.access.auditOnce(context,'numbering.allocated:'+policy.id+':'+periodKey+':'+sequence,'numbering.allocated',policy.id,{documentType:type,branchId:branch,periodKey,sequence,value});
  return{policyId:policy.id,documentType:type,branchId:policy.branchId,periodKey,sequence,value};
 }
 private async requirePolicy(companyId:string,id:string){const policy=await this.repo.findPolicy(companyId,required(id,'policyId'));if(!policy)throw new ContractValidationError('policyId','numbering policy was not found');return policy;}
}
