import{Prisma,type PrismaClient}from'@prisma/client';
import{ContractValidationError}from'@elhafez/contracts';
import type{CreateNumberingPolicyRecord,DocumentNumberingRepository,UpdateNumberingPolicyRecord,NumberAllocationRequest,StoredNumberAllocation}from'../application/document-numbering.repository.js';
import type{AllocatedDocumentNumber,NumberingPolicy}from'../domain/document-numbering.js';

export class PrismaDocumentNumberingRepository implements DocumentNumberingRepository{
 constructor(private readonly db:PrismaClient){}
 async findAllocation(companyId:string,requestId:string){const row=await this.db.dnNumberAllocation.findUnique({where:{companyId_requestId:{companyId,requestId}}});return row?{requestHash:row.requestHash,number:row.allocation as unknown as AllocatedDocumentNumber}:undefined;}
 async allocateOnce(input:NumberAllocationRequest):Promise<StoredNumberAllocation>{
  return this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify([input.companyId,input.requestId])},0))::text`;
   const prior=await tx.dnNumberAllocation.findUnique({where:{companyId_requestId:{companyId:input.companyId,requestId:input.requestId}}});
   if(prior){if(prior.requestHash!==input.requestHash)throw new ContractValidationError('requestId','conflicting numbering replay');return{requestHash:prior.requestHash,number:prior.allocation as unknown as AllocatedDocumentNumber};}
   const {policy,periodKey,companyId}=input,row=await tx.dnNumberingCounter.upsert({where:{companyId_policyId_periodKey:{companyId,policyId:policy.id,periodKey}},create:{companyId,policyId:policy.id,periodKey,currentValue:1},update:{currentValue:{increment:1}}});
   const number:AllocatedDocumentNumber={policyId:policy.id,documentType:policy.documentType,branchId:policy.branchId,periodKey,sequence:row.currentValue,value:policy.prefixTemplate.replaceAll('{YYYY}',input.year)+String(row.currentValue).padStart(policy.padding,'0')};
   await tx.dnNumberAllocation.create({data:{companyId,requestId:input.requestId,requestHash:input.requestHash,allocation:{...number}}});return{requestHash:input.requestHash,number};
  });
 }
 private policy(row:{id:string;companyId:string;documentType:string;branchScope:string;prefixTemplate:string;padding:number;resetPeriod:string;active:boolean;createdAt:Date;updatedAt:Date}):NumberingPolicy{return{id:row.id,companyId:row.companyId,documentType:row.documentType,branchId:row.branchScope==='*'?null:row.branchScope,prefixTemplate:row.prefixTemplate,padding:row.padding,resetPeriod:row.resetPeriod as NumberingPolicy['resetPeriod'],active:row.active,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString()};}
 async createPolicy(input:CreateNumberingPolicyRecord){try{return this.policy(await this.db.dnNumberingPolicy.create({data:{...input,createdAt:new Date(input.createdAt),updatedAt:new Date(input.updatedAt)}}));}catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')throw new ContractValidationError('documentType','numbering policy already exists for branch scope');throw error;}}
 async updatePolicy(companyId:string,id:string,input:UpdateNumberingPolicyRecord){const current=await this.db.dnNumberingPolicy.findFirst({where:{companyId,id}});if(!current)throw new ContractValidationError('policyId','numbering policy was not found');return this.policy(await this.db.dnNumberingPolicy.update({where:{id},data:{...input,updatedAt:new Date(input.updatedAt)}}));}
 async findPolicy(companyId:string,id:string){const row=await this.db.dnNumberingPolicy.findFirst({where:{companyId,id}});return row?this.policy(row):undefined;}
 async listPolicies(companyId:string,documentType?:string){return(await this.db.dnNumberingPolicy.findMany({where:{companyId,...(documentType?{documentType}: {})},orderBy:[{documentType:'asc'},{branchScope:'asc'}]})).map(row=>this.policy(row));}
 async findActivePolicy(companyId:string,documentType:string,branchId:string|null){const exact=branchId?await this.db.dnNumberingPolicy.findFirst({where:{companyId,documentType,branchScope:branchId,active:true}}):undefined;const row=exact??await this.db.dnNumberingPolicy.findFirst({where:{companyId,documentType,branchScope:'*',active:true}});return row?this.policy(row):undefined;}
 async allocateNext(companyId:string,policyId:string,periodKey:string){const row=await this.db.dnNumberingCounter.upsert({where:{companyId_policyId_periodKey:{companyId,policyId,periodKey}},create:{companyId,policyId,periodKey,currentValue:1},update:{currentValue:{increment:1}}});return row.currentValue;}
}
