import type{ClosureEvidenceRecord,ClosureEvidenceStatus}from'../domain/readiness.js';
export const READINESS_REPOSITORY=Symbol('READINESS_REPOSITORY');
export interface ClosureEvidenceAdvance{
 readonly status:ClosureEvidenceStatus;
 readonly updatedAt:string;
 readonly evidenceHash?:string;
 readonly evidence?:unknown;
 readonly financialEvidence?:unknown;
 readonly completedAt?:string;
}
export interface ReadinessRepository{
 reserve(value:ClosureEvidenceRecord):Promise<ClosureEvidenceRecord>;
 findByProgramVersion(companyId:string,branchId:string,programId:string,programUpdatedAt:string):Promise<ClosureEvidenceRecord|null>;
 latestForProgram(companyId:string,branchId:string,programId:string):Promise<ClosureEvidenceRecord|null>;
 advance(id:string,expectedStatus:ClosureEvidenceStatus,expectedRevision:number,next:ClosureEvidenceAdvance):Promise<ClosureEvidenceRecord>;
}
