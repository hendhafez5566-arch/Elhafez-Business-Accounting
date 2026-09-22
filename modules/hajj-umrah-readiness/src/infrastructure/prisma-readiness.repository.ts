import{Prisma,type PrismaClient}from'@prisma/client';
import{companyId}from'@elhafez/contracts';
import type{ReadinessRepository}from'../application/readiness.repository.js';
import type{ClosureEvidenceRecord}from'../domain/readiness.js';

const json=(value:unknown)=>value as Prisma.InputJsonValue;
const out=<T>(value:Prisma.JsonValue)=>value as unknown as T;
type Row={id:string;companyId:string;branchId:string;programId:string;programUpdatedAt:Date;commandKey:string;evidenceHash:string;evidence:Prisma.JsonValue;financialEvidence:Prisma.JsonValue|null;status:string;createdAt:Date;updatedAt:Date;completedAt:Date|null};
const map=(row:Row):ClosureEvidenceRecord=>({
 id:row.id,companyId:companyId(row.companyId),branchId:row.branchId,programId:row.programId,
 programUpdatedAt:row.programUpdatedAt.toISOString(),commandKey:row.commandKey,evidenceHash:row.evidenceHash,
 evidence:out(row.evidence),...(row.financialEvidence===null?{}:{financialEvidence:out(row.financialEvidence)}),
 status:row.status as ClosureEvidenceRecord['status'],createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString(),
 ...(row.completedAt?{completedAt:row.completedAt.toISOString()}:{}),
});
export class PrismaReadinessRepository implements ReadinessRepository{
 constructor(private readonly db:PrismaClient){}
 async reserve(value:ClosureEvidenceRecord){
  try{return map(await this.db.hureClosureEvidence.create({data:{id:value.id,companyId:value.companyId,branchId:value.branchId,programId:value.programId,programUpdatedAt:new Date(value.programUpdatedAt),commandKey:value.commandKey,evidenceHash:value.evidenceHash,evidence:json(value.evidence),status:value.status,createdAt:new Date(value.createdAt),updatedAt:new Date(value.updatedAt)}}))}
  catch(error){const old=await this.findByProgramVersion(value.companyId,value.branchId,value.programId,value.programUpdatedAt);if(old)return old;throw error}
 }
 async findByProgramVersion(company:string,branch:string,programId:string,programUpdatedAt:string){const row=await this.db.hureClosureEvidence.findUnique({where:{companyId_branchId_programId_programUpdatedAt:{companyId:company,branchId:branch,programId,programUpdatedAt:new Date(programUpdatedAt)}}});return row?map(row):null}
 async latestForProgram(company:string,branch:string,programId:string){const row=await this.db.hureClosureEvidence.findFirst({where:{companyId:company,branchId:branch,programId},orderBy:{updatedAt:'desc'}});return row?map(row):null}
 async save(value:ClosureEvidenceRecord){return map(await this.db.hureClosureEvidence.update({where:{id:value.id},data:{status:value.status,evidence:json(value.evidence),financialEvidence:value.financialEvidence===undefined?Prisma.DbNull:json(value.financialEvidence),updatedAt:new Date(value.updatedAt),completedAt:value.completedAt?new Date(value.completedAt):null}}))}
}
