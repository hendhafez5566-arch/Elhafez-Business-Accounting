import type { CompanyId } from '@elhafez/contracts';
import type { CommissionClaim } from '../domain/ecr.js';

export const COMMISSION_READ_REPOSITORY=Symbol('COMMISSION_READ_REPOSITORY');

export interface CommissionReadRepository {
  list(companyId:CompanyId,agentPartyId?:string):Promise<CommissionClaim[]>;
}
