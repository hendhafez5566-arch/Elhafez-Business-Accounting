import type { CompanyId } from '@elhafez/contracts';
import type { CommissionClaim } from '../domain/ecr.js';
import type { CommissionReadRepository } from './commission-read.repository.js';

export class CommissionReadApplicationService {
  constructor(private readonly repository:CommissionReadRepository){}
  listClaims(companyId:CompanyId,agentPartyId?:string):Promise<CommissionClaim[]>{return this.repository.list(companyId,agentPartyId?.trim()||undefined);}
}
