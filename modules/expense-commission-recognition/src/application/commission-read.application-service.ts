import type { CompanyId } from '@elhafez/contracts';
import type { CommissionReadRepository } from './commission-read.repository.js';

export class CommissionReadApplicationService {
  constructor(private readonly repository:CommissionReadRepository){}
  listClaims(companyId:CompanyId,agentPartyId?:string){return this.repository.list(companyId,agentPartyId?.trim()||undefined);}
}
