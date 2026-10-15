import { ContractValidationError } from '@elhafez/contracts';
export type OfflineOperation='BOOKING_CREATE'|'BOOKING_CONFIRM'|'BOOKING_DEPOSIT';
export const OFFLINE_OPERATIONS:readonly OfflineOperation[]=['BOOKING_CREATE','BOOKING_CONFIRM','BOOKING_DEPOSIT'];
export interface DeviceGrant {
 readonly id:string;readonly companyId:string;readonly branchId:string;readonly actorId:string;readonly deviceId:string;
 readonly operations:readonly OfflineOperation[];readonly issuedAt:string;readonly expiresAt:string;readonly revokedAt:string|null;
}
export interface OfflineCommand {
 readonly id:string;readonly companyId:string;readonly branchId:string;readonly actorId:string;readonly deviceId:string;
 readonly grantId:string;readonly operation:OfflineOperation;readonly payload:unknown;readonly payloadHash:string;
 readonly dependencies:readonly string[];readonly capturedAt:string;readonly receivedAt:string;
 readonly state:'PENDING'|'PROCESSING'|'ACCEPTED'|'REVIEW';readonly attempt:number;readonly leaseUntil:string|null;
 readonly result:unknown;readonly reason:string|null;
}
export function assertGrant(grant:DeviceGrant|undefined,command:OfflineCommand,now:Date):void {
 if(!grant||grant.id!==command.grantId||grant.companyId!==command.companyId||grant.branchId!==command.branchId||grant.actorId!==command.actorId||grant.deviceId!==command.deviceId)throw new ContractValidationError('grant','scope does not match device and execution context');
 if(grant.revokedAt)throw new ContractValidationError('grant','device delegation revoked');
 const at=Date.parse(command.capturedAt),issued=Date.parse(grant.issuedAt),expires=Date.parse(grant.expiresAt);
 if(!Number.isFinite(at)||at<issued||at>now.getTime()+30000)throw new ContractValidationError('clock','invalid capture time or clock rollback');
 if(at>=expires||now.getTime()>=expires)throw new ContractValidationError('grant','device delegation expired; manual review required');
 if(!grant.operations.includes(command.operation))throw new ContractValidationError('operation','operation outside device delegation');
}
