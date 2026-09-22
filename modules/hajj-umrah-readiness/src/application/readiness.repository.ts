import type{ClosureEvidenceRecord}from'../domain/readiness.js';
export const READINESS_REPOSITORY=Symbol('READINESS_REPOSITORY');
export interface ReadinessRepository{
 reserve(value:ClosureEvidenceRecord):Promise<ClosureEvidenceRecord>;
 findByProgramVersion(companyId:string,branchId:string,programId:string,programUpdatedAt:string):Promise<ClosureEvidenceRecord|null>;
 latestForProgram(companyId:string,branchId:string,programId:string):Promise<ClosureEvidenceRecord|null>;
 save(value:ClosureEvidenceRecord):Promise<ClosureEvidenceRecord>;
}
