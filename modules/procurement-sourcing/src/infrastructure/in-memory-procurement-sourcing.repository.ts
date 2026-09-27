import{ContractValidationError,type BranchId,type CompanyId}from'@elhafez/contracts';
import type{ProcurementSourcingRepository}from'../application/procurement-sourcing.repository.js';
import type{PurchaseRequisition,RequestForQuotation,SourcingAward,SupplierBid}from'../domain/procurement-sourcing.js';

const clone=<T>(value:T):T=>structuredClone(value);
export class InMemoryProcurementSourcingRepository implements ProcurementSourcingRepository{
 private readonly counters=new Map<string,number>();
 private readonly requisitions=new Map<string,PurchaseRequisition>();
 private readonly rfqs=new Map<string,RequestForQuotation>();
 private readonly bids=new Map<string,SupplierBid>();
 private readonly awards=new Map<string,SourcingAward>();
 private key(c:CompanyId,b:BranchId,id:string){return c+'|'+b+'|'+id;}
 async nextNumber(c:CompanyId,b:BranchId,kind:'PR'|'RFQ'){const key=c+'|'+b+'|'+kind,n=(this.counters.get(key)??0)+1;this.counters.set(key,n);return n;}
 async createRequisition(value:PurchaseRequisition){const key=this.key(value.companyId,value.branchId,value.id);if(this.requisitions.has(key))throw new ContractValidationError('requisitionId','already exists');this.requisitions.set(key,clone(value));return clone(value);}
 async updateRequisition(value:PurchaseRequisition){const key=this.key(value.companyId,value.branchId,value.id);if(!this.requisitions.has(key))throw new ContractValidationError('requisitionId','was not found');this.requisitions.set(key,clone(value));return clone(value);}
 async findRequisition(c:CompanyId,b:BranchId,id:string){const value=this.requisitions.get(this.key(c,b,id));return value?clone(value):undefined;}
 async listRequisitions(c:CompanyId,b:BranchId){return[...this.requisitions.values()].filter(x=>x.companyId===c&&x.branchId===b).sort((a,z)=>z.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(z.id)).map(clone);}
 async createRfq(value:RequestForQuotation,requisition:PurchaseRequisition){const key=this.key(value.companyId,value.branchId,value.id);if(this.rfqs.has(key))throw new ContractValidationError('rfqId','already exists');await this.updateRequisition(requisition);this.rfqs.set(key,clone(value));return clone(value);}
 async updateRfq(value:RequestForQuotation){const key=this.key(value.companyId,value.branchId,value.id);if(!this.rfqs.has(key))throw new ContractValidationError('rfqId','was not found');this.rfqs.set(key,clone(value));return clone(value);}
 async findRfq(c:CompanyId,b:BranchId,id:string){const value=this.rfqs.get(this.key(c,b,id));return value?clone(value):undefined;}
 async listRfqs(c:CompanyId,b:BranchId){return[...this.rfqs.values()].filter(x=>x.companyId===c&&x.branchId===b).sort((a,z)=>z.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(z.id)).map(clone);}
 async saveBid(value:SupplierBid){const key=this.key(value.companyId,value.branchId,value.id);this.bids.set(key,clone(value));return clone(value);}
 async findBid(c:CompanyId,b:BranchId,id:string){const value=this.bids.get(this.key(c,b,id));return value?clone(value):undefined;}
 async listBids(c:CompanyId,b:BranchId,rfqId:string){return[...this.bids.values()].filter(x=>x.companyId===c&&x.branchId===b&&x.rfqId===rfqId).sort((a,z)=>a.submittedAt.localeCompare(z.submittedAt)||a.id.localeCompare(z.id)).map(clone);}
 async commitAward(input:{award:SourcingAward;requisition:PurchaseRequisition;rfq:RequestForQuotation;bids:readonly SupplierBid[]}){const existing=await this.findAwardByRfq(input.award.companyId,input.award.branchId,input.award.rfqId);if(existing){if(existing.bidId===input.award.bidId)return existing;throw new ContractValidationError('award','RFQ already has an award');}await this.updateRequisition(input.requisition);await this.updateRfq(input.rfq);for(const bid of input.bids)await this.saveBid(bid);this.awards.set(this.key(input.award.companyId,input.award.branchId,input.award.id),clone(input.award));return clone(input.award);}
 async updateAward(value:SourcingAward){const key=this.key(value.companyId,value.branchId,value.id);if(!this.awards.has(key))throw new ContractValidationError('awardId','was not found');this.awards.set(key,clone(value));return clone(value);}
 async findAward(c:CompanyId,b:BranchId,id:string){const value=this.awards.get(this.key(c,b,id));return value?clone(value):undefined;}
 async findAwardByRfq(c:CompanyId,b:BranchId,rfqId:string){const value=[...this.awards.values()].find(x=>x.companyId===c&&x.branchId===b&&x.rfqId===rfqId);return value?clone(value):undefined;}
 async listAwards(c:CompanyId,b:BranchId){return[...this.awards.values()].filter(x=>x.companyId===c&&x.branchId===b).sort((a,z)=>z.awardedAt.localeCompare(a.awardedAt)||a.id.localeCompare(z.id)).map(clone);}
}
