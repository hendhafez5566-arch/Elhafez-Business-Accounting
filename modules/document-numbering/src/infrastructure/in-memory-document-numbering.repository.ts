import{ContractValidationError}from'@elhafez/contracts';
import type{CreateNumberingPolicyRecord,DocumentNumberingRepository,UpdateNumberingPolicyRecord}from'../application/document-numbering.repository.js';
import type{NumberingPolicy}from'../domain/document-numbering.js';
export class InMemoryDocumentNumberingRepository implements DocumentNumberingRepository{
 private policies=new Map<string,NumberingPolicy>();private counters=new Map<string,number>();private tail:Promise<void>=Promise.resolve();
 private async atomic<T>(fn:()=>T|Promise<T>):Promise<T>{const prior=this.tail;let release!:()=>void;this.tail=new Promise<void>(resolve=>{release=resolve;});await prior;try{return await fn();}finally{release();}}
 private map(input:CreateNumberingPolicyRecord):NumberingPolicy{return{id:input.id,companyId:input.companyId,documentType:input.documentType,branchId:input.branchScope==='*'?null:input.branchScope,prefixTemplate:input.prefixTemplate,padding:input.padding,resetPeriod:input.resetPeriod,active:input.active,createdAt:input.createdAt,updatedAt:input.updatedAt};}
 async createPolicy(input:CreateNumberingPolicyRecord){return this.atomic(async()=>{if([...this.policies.values()].some(v=>v.companyId===input.companyId&&v.documentType===input.documentType&&(v.branchId??'*')===input.branchScope))throw new ContractValidationError('documentType','numbering policy already exists for branch scope');const policy=this.map(input);this.policies.set(policy.id,policy);return policy;});}
 async updatePolicy(companyId:string,id:string,input:UpdateNumberingPolicyRecord){const current=await this.findPolicy(companyId,id);if(!current)throw new ContractValidationError('policyId','numbering policy was not found');const next:NumberingPolicy={...current,...input};this.policies.set(id,next);return next;}
 async findPolicy(companyId:string,id:string){const policy=this.policies.get(id);return policy?.companyId===companyId?policy:undefined;}
 async listPolicies(companyId:string,documentType?:string){return[...this.policies.values()].filter(v=>v.companyId===companyId&&(!documentType||v.documentType===documentType)).sort((a,b)=>a.documentType.localeCompare(b.documentType)||(a.branchId??'').localeCompare(b.branchId??''));}
 async findActivePolicy(companyId:string,documentType:string,branchId:string|null){const candidates=[...this.policies.values()].filter(v=>v.companyId===companyId&&v.documentType===documentType&&v.active);return candidates.find(v=>v.branchId===branchId)??candidates.find(v=>v.branchId===null);}
 async allocateNext(companyId:string,policyId:string,periodKey:string){return this.atomic(async()=>{const key=[companyId,policyId,periodKey].join(':');const next=(this.counters.get(key)??0)+1;this.counters.set(key,next);return next;});}
}
