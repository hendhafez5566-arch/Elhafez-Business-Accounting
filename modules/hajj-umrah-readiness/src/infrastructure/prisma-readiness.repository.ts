import{Prisma,type PrismaClient}from'@prisma/client';
import{companyId}from'@elhafez/contracts';
import type{ClosureEvidenceAdvance,ReadinessRepository}from'../application/readiness.repository.js';
import type{ClosureEvidenceRecord,ClosureEvidenceStatus}from'../domain/readiness.js';

const json=(value:unknown)=>value as Prisma.InputJsonValue;
const out=<T>(value:Prisma.JsonValue)=>value as unknown as T;
type Row={id:string;companyId:string;branchId:string;programId:string;programUpdatedAt:Date;commandKey:string;evidenceHash:string;evidence:Prisma.JsonValue;financialEvidence:Prisma.JsonValue|null;status:string;revision:number;createdAt:Date;updatedAt:Date;completedAt:Date|null};
const map=(row:Row):ClosureEvidenceRecord=>({
 id:row.id,companyId:companyId(row.companyId),branchId:row.branchId,programId:row.programId,
 programUpdatedAt:row.programUpdatedAt.toISOString(),commandKey:row.commandKey,evidenceHash:row.evidenceHash,
 evidence:out(row.evidence),...(row.financialEvidence===null?{}:{financialEvidence:out(row.financialEvidence)}),
 status:row.status as ClosureEvidenceStatus,revision:row.revision,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString(),
 ...(row.completedAt?{completedAt:row.completedAt.toISOString()}:{}),
});
const nextStatus:Readonly<Record<Exclude<ClosureEvidenceStatus,'COMPLETED'>,ClosureEvidenceStatus>>={
 PREPARED:'OWNER_CLOSED',OWNER_CLOSED:'FINANCE_CONFIRMED',FINANCE_CONFIRMED:'COMPLETED',
};
const rank:Readonly<Record<ClosureEvidenceStatus,number>>={PREPARED:0,OWNER_CLOSED:1,FINANCE_CONFIRMED:2,COMPLETED:3};

export class PrismaReadinessRepository implements ReadinessRepository{
 constructor(private readonly db:PrismaClient){}
 async reserve(value:ClosureEvidenceRecord){
  try{return map(await this.db.hureClosureEvidence.create({data:{id:value.id,companyId:value.companyId,branchId:value.branchId,programId:value.programId,programUpdatedAt:new Date(value.programUpdatedAt),commandKey:value.commandKey,evidenceHash:value.evidenceHash,evidence:json(value.evidence),status:value.status,revision:value.revision,createdAt:new Date(value.createdAt),updatedAt:new Date(value.updatedAt)}}))}
  catch(error){const old=await this.findByProgramVersion(value.companyId,value.branchId,value.programId,value.programUpdatedAt);if(old)return old;throw error}
 }
 async findByProgramVersion(company:string,branch:string,programId:string,programUpdatedAt:string){const row=await this.db.hureClosureEvidence.findUnique({where:{companyId_branchId_programId_programUpdatedAt:{companyId:company,branchId:branch,programId,programUpdatedAt:new Date(programUpdatedAt)}}});return row?map(row):null}
 async latestForProgram(company:string,branch:string,programId:string){const row=await this.db.hureClosureEvidence.findFirst({where:{companyId:company,branchId:branch,programId},orderBy:[{programUpdatedAt:'desc'},{createdAt:'desc'}]});return row?map(row):null}
 async advance(id:string,expectedStatus:ClosureEvidenceStatus,expectedRevision:number,next:ClosureEvidenceAdvance){
  if(expectedStatus==='COMPLETED'||nextStatus[expectedStatus]!==next.status)throw new Error(`invalid closure evidence transition ${expectedStatus} -> ${next.status}`);
  const data:Prisma.HureClosureEvidenceUpdateManyMutationInput={
   status:next.status,revision:{increment:1},updatedAt:new Date(next.updatedAt),
   ...(next.evidenceHash!==undefined?{evidenceHash:next.evidenceHash}:{}),
   ...(next.evidence!==undefined?{evidence:json(next.evidence)}:{}),
   ...(next.financialEvidence!==undefined?{financialEvidence:json(next.financialEvidence)}:{}),
   ...(next.status==='COMPLETED'&&next.completedAt?{completedAt:new Date(next.completedAt)}:{}),
  };
  const changed=await this.db.hureClosureEvidence.updateMany({where:{id,status:expectedStatus,revision:expectedRevision},data});
  const current=await this.db.hureClosureEvidence.findUnique({where:{id}});
  if(!current)throw new Error('closure evidence not found');
  const mapped=map(current);
  if(changed.count===1)return mapped;
  if(rank[mapped.status]>=rank[next.status])return mapped;
  throw new Error('closure evidence CAS conflict');
 }
}
