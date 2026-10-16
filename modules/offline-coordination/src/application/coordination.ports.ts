import type { ExecutionContext } from '@elhafez/contracts';
import type { DeviceGrant, OfflineCommand, OfflineOperation } from '../domain/coordination.js';
export interface CoordinationRepository {
 listReview(context:ExecutionContext):Promise<OfflineCommand[]>;
 claimReview(context:ExecutionContext,id:string,reason:string,now:string,until:string):Promise<OfflineCommand|undefined>;
 saveGrant(grant:DeviceGrant):Promise<void>;
 grant(context:ExecutionContext,id:string):Promise<DeviceGrant|undefined>;
 revoke(context:ExecutionContext,id:string,at:string):Promise<void>;
 reserve(command:OfflineCommand):Promise<OfflineCommand>;
 get(context:ExecutionContext,id:string):Promise<OfflineCommand|undefined>;
 list(context:ExecutionContext):Promise<OfflineCommand[]>;
 claim(context:ExecutionContext,id:string,now:string,until:string):Promise<OfflineCommand|undefined>;
 finish(command:OfflineCommand,state:'PENDING'|'ACCEPTED'|'REVIEW',result:unknown,reason:string|null):Promise<OfflineCommand>;
}
export interface CoordinationAccess {
 authorizeReview(context:ExecutionContext):Promise<void>;
 requireContext(context:ExecutionContext):Promise<void>;
 authorize(context:ExecutionContext,operation:OfflineOperation):Promise<void>;
}
/** Owner operation must durably deduplicate using command.id, never an attempt id. */
export interface CoordinationOwner { execute(context:ExecutionContext,command:OfflineCommand):Promise<unknown> }
export const COORDINATION_REPOSITORY=Symbol('COORDINATION_REPOSITORY');
export const COORDINATION_ACCESS=Symbol('COORDINATION_ACCESS');
export const COORDINATION_OWNER=Symbol('COORDINATION_OWNER');
