import { ContractValidationError } from '@elhafez/contracts';
export interface WriteAuthority {readonly companyId:string;readonly authorityId:string;readonly enrolledBy:string;readonly enrolledAt:string;}
export interface WriteAuthorityRepository {get(companyId:string):Promise<WriteAuthority|undefined>;enroll(value:WriteAuthority):Promise<WriteAuthority>;}
export const WRITE_AUTHORITY_REPOSITORY=Symbol('WRITE_AUTHORITY_REPOSITORY');
/** No transfer/promotion method exists. Moving authority needs external fencing first. */
export class WriteAuthorityApplicationService {
 constructor(private readonly repo:WriteAuthorityRepository){}
 async enroll(companyId:string,authorityId:string,actorId:string){
  if(!/^[A-Za-z0-9][A-Za-z0-9_-]{15,127}$/.test(authorityId))throw new ContractValidationError('authorityId','configured stable server identity required');
  const value=await this.repo.enroll({companyId,authorityId,enrolledBy:actorId,enrolledAt:new Date().toISOString()});
  if(value.authorityId!==authorityId)throw new ContractValidationError('authority','authority already enrolled; heartbeat loss never permits promotion');
  return value;
 }
 async assert(companyId:string,serverId:string|undefined){
  const authority=await this.repo.get(companyId);
  if(!authority){if(serverId)throw new ContractValidationError('authority','office authority must be enrolled before business writes');return;}
  if(!serverId||authority.authorityId!==serverId)throw new ContractValidationError('authority','this server has no company write authority');
 }
}
