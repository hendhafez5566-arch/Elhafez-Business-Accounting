import { createHash } from 'node:crypto';
import { ContractValidationError } from '@elhafez/contracts';
import type { Followup } from '../domain/followup.js';

export interface ScheduleRequest {
 readonly id:string;
 readonly actorId:string;
 readonly fingerprint:string;
}
export interface ScheduledRequestResult {
 readonly followup:Followup;
 readonly fingerprint:string;
 readonly created:boolean;
}
export function scheduleRequest(id:string,actorId:string,payload:readonly unknown[]):ScheduleRequest {
 if(typeof id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{15,127}$/.test(id))throw new ContractValidationError('requestId','must contain 16 to 128 letters, digits, underscores or hyphens');
 return {id,actorId,fingerprint:createHash('sha256').update(JSON.stringify(payload)).digest('hex')};
}
export function acceptedSchedule(result:ScheduledRequestResult,request:ScheduleRequest):Followup {
 if(result.fingerprint!==request.fingerprint)throw new ContractValidationError('requestId','was already accepted with different follow-up data; do not change a retried request');
 return result.followup;
}
