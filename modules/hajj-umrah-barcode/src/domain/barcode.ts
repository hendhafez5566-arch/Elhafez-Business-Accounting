import type{CompanyId}from'@elhafez/contracts';
export type BarcodeStatus='ASSIGNED'|'ACTIVE'|'USED'|'CANCELLED';
export interface UmrahBarcode{readonly id:string;readonly companyId:CompanyId;readonly branchId:string;readonly programId:string;readonly visaCaseId:string;readonly travelerId:string;readonly code:string;readonly status:BarcodeStatus;readonly assignedBy:string;readonly assignedAt:string;readonly updatedAt:string;readonly revision:number;}
export interface BarcodeHistory{readonly id:string;readonly companyId:CompanyId;readonly branchId:string;readonly barcodeId:string;readonly fromStatus:BarcodeStatus|null;readonly toStatus:BarcodeStatus;readonly actorId:string;readonly reason:string|null;readonly occurredAt:string;}
