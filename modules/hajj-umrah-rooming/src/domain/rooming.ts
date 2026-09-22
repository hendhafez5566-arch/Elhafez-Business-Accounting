import type { CompanyId } from '@elhafez/contracts';
export type RoomAssignmentStatus='ASSIGNED'|'UNASSIGNED';
export interface RoomAssignment{readonly id:string;readonly companyId:CompanyId;readonly branchId:string;readonly programId:string;readonly bookingId:string;readonly travelerId:string;readonly allocationId:string;readonly roomKey:string;readonly roomLabel?:string;readonly startDate:string;readonly endDate:string;readonly status:RoomAssignmentStatus;readonly createdAt:string;readonly updatedAt:string;}
export interface RoomingHistory{readonly id:string;readonly companyId:CompanyId;readonly branchId:string;readonly assignmentId:string;readonly action:'ASSIGNED'|'REASSIGNED'|'SWAPPED'|'UNASSIGNED';readonly snapshot:RoomAssignment;readonly actorId:string;readonly occurredAt:string;}
