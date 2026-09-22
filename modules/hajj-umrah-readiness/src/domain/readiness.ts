import type{CompanyId,SourceReference}from'@elhafez/contracts';

export type ReadinessStatus='READY'|'NOT_READY';
export type ReadinessBlockerCategory='TRAVELER_DOCUMENT'|'ROOMING'|'VISA'|'TICKETING'|'TRANSPORT'|'SERVICE_OPERATION'|'FINANCIAL'|'CONTROL'|'PROGRAM';
export interface ReadinessBlocker{
 readonly category:ReadinessBlockerCategory;
 readonly code:string;
 readonly message:string;
 readonly owner:string;
 readonly responsibility:string;
 readonly programId:string;
 readonly bookingId?:string;
 readonly travelerId?:string;
 readonly reference?:SourceReference;
 readonly evidenceReferences:readonly string[];
}
export interface ReadinessResult{
 readonly status:ReadinessStatus;
 readonly blockers:readonly ReadinessBlocker[];
 readonly evidenceReferences:readonly string[];
}
export type ClosureEvidenceStatus='PREPARED'|'FINANCE_CONFIRMED'|'COMPLETED';
export interface ClosureEvidenceRecord{
 readonly id:string;
 readonly companyId:CompanyId;
 readonly branchId:string;
 readonly programId:string;
 readonly programUpdatedAt:string;
 readonly commandKey:string;
 readonly evidenceHash:string;
 readonly evidence:unknown;
 readonly financialEvidence?:unknown;
 readonly status:ClosureEvidenceStatus;
 readonly createdAt:string;
 readonly updatedAt:string;
 readonly completedAt?:string;
}
