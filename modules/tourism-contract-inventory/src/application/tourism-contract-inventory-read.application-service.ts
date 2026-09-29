import type{CompanyId}from'@elhafez/contracts';import type{TourismInventoryReadRepository}from'./inventory-read.repository.js';
export class TourismContractInventoryReadApplicationService{constructor(private readonly repo:TourismInventoryReadRepository){}listAvailable(companyId:CompanyId){return this.repo.listAvailable(companyId)}}
