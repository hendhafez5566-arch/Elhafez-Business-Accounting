import{randomUUID}from'node:crypto';
import{ContractValidationError,decimalAmount,type DecimalAmount,type ExecutionContext}from'@elhafez/contracts';
import type{ProcurementSourcingAccess}from'./procurement-sourcing.access.js';
import type{SourcingProcurementPort,SourcingSupplierPort}from'./procurement-sourcing.ports.js';
import type{ProcurementSourcingRepository}from'./procurement-sourcing.repository.js';
import type{BidComparisonRow,CreateRequisitionInput,CreateRfqInput,PurchaseRequisition,PurchaseRequisitionLine,RecordSupplierBidInput,RequestForQuotation,SourcingAward,SupplierBid,SupplierBidLine,UpdateRequisitionInput}from'../domain/procurement-sourcing.js';

export const PROCUREMENT_SOURCING_PERMISSIONS=Object.freeze({
 read:'procurement.sourcing.read',
 manage:'procurement.sourcing.manage',
 approve:'procurement.sourcing.approve',
 award:'procurement.sourcing.award',
}as const);

const SCALE=10n**18n;
function required(value:string|undefined|null,field:string){const x=value?.trim()??'';if(!x)throw new ContractValidationError(field,'is required');return x;}
function optional(value:string|undefined|null){return value?.trim()||null;}
function isoDate(value:string|undefined|null,field:string,optionalValue=false){if(optionalValue&&!value?.trim())return null;const x=required(value,field);if(!/^\d{4}-\d{2}-\d{2}$/.test(x)||Number.isNaN(Date.parse(x+'T00:00:00Z')))throw new ContractValidationError(field,'must be a valid ISO date');return x;}
function positive(value:string,field:string):DecimalAmount{const x=decimalAmount(value);if(scaled(x)<=0n)throw new ContractValidationError(field,'must be positive');return x;}
function nonNegative(value:string|undefined|null,field:string):DecimalAmount|null{if(value==null||!String(value).trim())return null;const x=decimalAmount(value);if(scaled(x)<0n)throw new ContractValidationError(field,'must be non-negative');return x;}
function scaled(value:DecimalAmount|string){const text=String(value),negative=text.startsWith('-'),u=negative?text.slice(1):text,[whole='0',fraction='']=u.split('.');if(fraction.length>18)throw new ContractValidationError('decimal','supports at most 18 fractional digits');const raw=BigInt(whole)*SCALE+BigInt(fraction.padEnd(18,'0'));return negative?-raw:raw;}
function decimal(value:bigint):DecimalAmount{const negative=value<0n,abs=negative?-value:value,whole=abs/SCALE,fraction=abs%SCALE;return decimalAmount((negative?'-':'')+whole+(fraction?'.'+fraction.toString().padStart(18,'0').replace(/0+$/,''):''));}
function normalizeCurrency(value:string|undefined|null,requiredWhen=false){const x=value?.trim().toUpperCase()??'';if(!x&&!requiredWhen)return null;if(!/^[A-Z]{3}$/.test(x))throw new ContractValidationError('currency','must be a three-letter currency code');return x;}
function sameDayOrAfter(value:string,base:string,field:string){if(value<base)throw new ContractValidationError(field,'must not be before '+base);return value;}

export class ProcurementSourcingApplicationService{
 constructor(
  private readonly repo:ProcurementSourcingRepository,
  private readonly suppliers:SourcingSupplierPort,
  private readonly procurement:SourcingProcurementPort,
  private readonly access:ProcurementSourcingAccess,
  private readonly now:()=>Date=()=>new Date(),
  private readonly newId:()=>string=()=>randomUUID(),
 ){}
 private async permission(c:ExecutionContext,p:string){await this.access.requireBranch(c);await this.access.requirePermission(c,p);}
 private async requisition(c:ExecutionContext,id:string){const value=await this.repo.findRequisition(c.companyId,c.branchId,required(id,'requisitionId'));if(!value)throw new ContractValidationError('requisitionId','purchase requisition was not found in this company and branch');return value;}
 private async rfq(c:ExecutionContext,id:string){const value=await this.repo.findRfq(c.companyId,c.branchId,required(id,'rfqId'));if(!value)throw new ContractValidationError('rfqId','RFQ was not found in this company and branch');return value;}
 private lines(requisitionId:string,inputs:CreateRequisitionInput['lines']):PurchaseRequisitionLine[]{if(!inputs.length)throw new ContractValidationError('lines','at least one requisition line is required');const ids=new Set<string>();return inputs.map((line,index)=>{const id=line.id?.trim()||this.newId();if(ids.has(id))throw new ContractValidationError('lines.'+index+'.id','duplicate line id');ids.add(id);return{id,requisitionId,itemReference:required(line.itemReference,'lines.'+index+'.itemReference'),description:optional(line.description),quantity:positive(line.quantity,'lines.'+index+'.quantity'),targetUnitPrice:nonNegative(line.targetUnitPrice,'lines.'+index+'.targetUnitPrice'),requiredDate:isoDate(line.requiredDate,'lines.'+index+'.requiredDate',true)};});}
 async createRequisition(c:ExecutionContext,input:CreateRequisitionInput):Promise<PurchaseRequisition>{
  await this.permission(c,PROCUREMENT_SOURCING_PERMISSIONS.manage);
  const id=input.id?.trim()||this.newId(),sequence=await this.repo.nextNumber(c.companyId,c.branchId,'PR'),at=this.now().toISOString(),currency=normalizeCurrency(input.currency),needByDate=isoDate(input.needByDate,'needByDate',true);
  const value:PurchaseRequisition={id,companyId:c.companyId,branchId:c.branchId,number:'PR-'+String(sequence).padStart(6,'0'),status:'DRAFT',requestedBy:c.actorId,needByDate,currency,notes:optional(input.notes),approvedBy:null,approvedAt:null,approvalReason:null,createdAt:at,updatedAt:at,lines:this.lines(id,input.lines)};
  const created=await this.repo.createRequisition(value);await this.access.auditOnce(c,'procurement.sourcing.requisition.created:'+created.id,'procurement.sourcing.requisition.created','purchase-requisition',created.id,{number:created.number});return created;
 }
 async updateDraftRequisition(c:ExecutionContext,id:string,input:UpdateRequisitionInput){
  await this.permission(c,PROCUREMENT_SOURCING_PERMISSIONS.manage);const current=await this.requisition(c,id);if(current.status!=='DRAFT')throw new ContractValidationError('status','only a draft requisition may be edited');
  const updated:PurchaseRequisition={...current,needByDate:input.needByDate===undefined?current.needByDate:isoDate(input.needByDate,'needByDate',true),currency:input.currency===undefined?current.currency:normalizeCurrency(input.currency),notes:input.notes===undefined?current.notes:optional(input.notes),updatedAt:this.now().toISOString(),lines:this.lines(current.id,input.lines)};
  const saved=await this.repo.updateRequisition(updated);await this.access.auditOnce(c,'procurement.sourcing.requisition.updated:'+saved.id+':'+saved.updatedAt,'procurement.sourcing.requisition.updated','purchase-requisition',saved.id);return saved;
 }
 async listRequisitions(c:ExecutionContext){await this.permission(c,PROCUREMENT_SOURCING_PERMISSIONS.read);return this.repo.listRequisitions(c.companyId,c.branchId);}
 async getRequisition(c:ExecutionContext,id:string){await this.permission(c,PROCUREMENT_SOURCING_PERMISSIONS.read);return this.requisition(c,id);}
 async submitRequisition(c:ExecutionContext,id:string){
  await this.permission(c,PROCUREMENT_SOURCING_PERMISSIONS.manage);const current=await this.requisition(c,id);if(current.status==='SUBMITTED')return current;if(current.status!=='DRAFT')throw new ContractValidationError('status','only a draft requisition may be submitted');
  if(current.needByDate){const today=this.now().toISOString().slice(0,10);sameDayOrAfter(current.needByDate,today,'needByDate');}
  const saved=await this.repo.updateRequisition({...current,status:'SUBMITTED',updatedAt:this.now().toISOString()});await this.access.auditOnce(c,'procurement.sourcing.requisition.submitted:'+saved.id,'procurement.sourcing.requisition.submitted','purchase-requisition',saved.id);return saved;
 }
 async decideRequisition(c:ExecutionContext,id:string,outcome:'APPROVED'|'REJECTED',reason:string){
  await this.permission(c,PROCUREMENT_SOURCING_PERMISSIONS.approve);const current=await this.requisition(c,id);if(current.status===outcome)return current;if(current.status!=='SUBMITTED')throw new ContractValidationError('status','only a submitted requisition may be approved or rejected');const why=required(reason,'reason'),at=this.now().toISOString();
  const saved=await this.repo.updateRequisition({...current,status:outcome,approvedBy:c.actorId,approvedAt:at,approvalReason:why,updatedAt:at});await this.access.auditOnce(c,'procurement.sourcing.requisition.decided:'+saved.id+':'+outcome,'procurement.sourcing.requisition.'+outcome.toLowerCase(),'purchase-requisition',saved.id,{reason:why});return saved;
 }
 async createRfq(c:ExecutionContext,requisitionId:string,input:CreateRfqInput):Promise<RequestForQuotation>{
  await this.permission(c,PROCUREMENT_SOURCING_PERMISSIONS.manage);const requisition=await this.requisition(c,requisitionId);if(requisition.status!=='APPROVED'&&requisition.status!=='SOURCING')throw new ContractValidationError('status','RFQ requires an approved requisition');
  const existing=(await this.repo.listRfqs(c.companyId,c.branchId)).find(row=>row.requisitionId===requisition.id&&!['CANCELLED','CLOSED'].includes(row.status));if(existing)return existing;
  const deadline=isoDate(input.responseDeadline,'responseDeadline')!,today=this.now().toISOString().slice(0,10);sameDayOrAfter(deadline,today,'responseDeadline');const seq=await this.repo.nextNumber(c.companyId,c.branchId,'RFQ'),at=this.now().toISOString();
  const rfq:RequestForQuotation={id:input.id?.trim()||this.newId(),companyId:c.companyId,branchId:c.branchId,requisitionId:requisition.id,number:'RFQ-'+String(seq).padStart(6,'0'),status:'DRAFT',responseDeadline:deadline,notes:optional(input.notes),createdBy:c.actorId,createdAt:at,sentAt:null,closedAt:null,supplierPartyIds:[]};
  const saved=await this.repo.createRfq(rfq,{...requisition,status:'SOURCING',updatedAt:at});await this.access.auditOnce(c,'procurement.sourcing.rfq.created:'+saved.id,'procurement.sourcing.rfq.created','procurement-rfq',saved.id,{requisitionId:requisition.id});return saved;
 }
 async inviteSupplier(c:ExecutionContext,rfqId:string,supplierReference:string){
  await this.permission(c,PROCUREMENT_SOURCING_PERMISSIONS.manage);const rfq=await this.rfq(c,rfqId);if(rfq.status!=='DRAFT')throw new ContractValidationError('status','suppliers can only be invited while RFQ is draft');const supplier=await this.suppliers.assertUsable(c.companyId,required(supplierReference,'supplierReference'));if(rfq.supplierPartyIds.includes(supplier.partyId))return rfq;
  const saved=await this.repo.updateRfq({...rfq,supplierPartyIds:[...rfq.supplierPartyIds,supplier.partyId]});await this.access.auditOnce(c,'procurement.sourcing.rfq.invited:'+saved.id+':'+supplier.partyId,'procurement.sourcing.rfq.supplier-invited','procurement-rfq',saved.id,{supplierPartyId:supplier.partyId});return saved;
 }
 async sendRfq(c:ExecutionContext,id:string){
  await this.permission(c,PROCUREMENT_SOURCING_PERMISSIONS.manage);const current=await this.rfq(c,id);if(current.status==='SENT')return current;if(current.status!=='DRAFT')throw new ContractValidationError('status','only a draft RFQ may be sent');if(!current.supplierPartyIds.length)throw new ContractValidationError('suppliers','at least one approved supplier must be invited');
  const saved=await this.repo.updateRfq({...current,status:'SENT',sentAt:this.now().toISOString()});await this.access.auditOnce(c,'procurement.sourcing.rfq.sent:'+saved.id,'procurement.sourcing.rfq.sent','procurement-rfq',saved.id,{supplierCount:saved.supplierPartyIds.length});return saved;
 }
 async listRfqs(c:ExecutionContext){await this.permission(c,PROCUREMENT_SOURCING_PERMISSIONS.read);return this.repo.listRfqs(c.companyId,c.branchId);}
 async getRfq(c:ExecutionContext,id:string){await this.permission(c,PROCUREMENT_SOURCING_PERMISSIONS.read);return this.rfq(c,id);}
 async recordBid(c:ExecutionContext,rfqId:string,input:RecordSupplierBidInput):Promise<SupplierBid>{
  await this.permission(c,PROCUREMENT_SOURCING_PERMISSIONS.manage);const rfq=await this.rfq(c,rfqId);if(rfq.status!=='SENT')throw new ContractValidationError('status','supplier bids require a sent RFQ');const supplier=await this.suppliers.assertUsable(c.companyId,required(input.supplierReference,'supplierReference'));if(!rfq.supplierPartyIds.includes(supplier.partyId))throw new ContractValidationError('supplierReference','supplier was not invited to this RFQ');
  const req=await this.requisition(c,rfq.requisitionId),reqLines=new Map(req.lines.map(line=>[line.id,line])),currency=normalizeCurrency(input.currency,true)!;if(req.currency&&currency!==req.currency)throw new ContractValidationError('currency','bid currency must match the requisition currency');const existingBids=await this.repo.listBids(c.companyId,c.branchId,rfq.id),activeCurrency=existingBids.find(row=>row.status==='RECEIVED')?.currency;if(activeCurrency&&currency!==activeCurrency)throw new ContractValidationError('currency','all active bids in an RFQ must use the same currency for deterministic comparison');if(input.lines.length!==req.lines.length)throw new ContractValidationError('lines','bid must quote every requisition line exactly once');const seen=new Set<string>(),bidId=input.id?.trim()||this.newId();
  const lines:SupplierBidLine[]=input.lines.map((line,index)=>{const reqLine=reqLines.get(required(line.requisitionLineId,'lines.'+index+'.requisitionLineId'));if(!reqLine||seen.has(reqLine.id))throw new ContractValidationError('lines.'+index+'.requisitionLineId','must reference each requisition line exactly once');seen.add(reqLine.id);const quantity=positive(line.quantity,'lines.'+index+'.quantity');if(scaled(quantity)>scaled(reqLine.quantity))throw new ContractValidationError('lines.'+index+'.quantity','cannot exceed requested quantity');return{id:line.id?.trim()||this.newId(),bidId,requisitionLineId:reqLine.id,quantity,unitPrice:positive(line.unitPrice,'lines.'+index+'.unitPrice'),taxCode:optional(line.taxCode)};});
  const duplicate=existingBids.find(row=>row.supplierPartyId===supplier.partyId&&row.status==='RECEIVED');if(duplicate)throw new ContractValidationError('supplierReference','an active bid already exists for this supplier and RFQ');
  const bid:SupplierBid={id:bidId,companyId:c.companyId,branchId:c.branchId,rfqId:rfq.id,supplierPartyId:supplier.partyId,currency,validUntil:isoDate(input.validUntil,'validUntil',true),deliveryDate:isoDate(input.deliveryDate,'deliveryDate',true),terms:optional(input.terms),status:'RECEIVED',submittedAt:this.now().toISOString(),lines};
  const saved=await this.repo.saveBid(bid);await this.access.auditOnce(c,'procurement.sourcing.bid.recorded:'+saved.id,'procurement.sourcing.bid.recorded','supplier-bid',saved.id,{rfqId:rfq.id,supplierPartyId:saved.supplierPartyId});return saved;
 }
 async listBids(c:ExecutionContext,rfqId:string){await this.permission(c,PROCUREMENT_SOURCING_PERMISSIONS.read);await this.rfq(c,rfqId);return this.repo.listBids(c.companyId,c.branchId,rfqId);}
 async withdrawBid(c:ExecutionContext,rfqId:string,bidId:string){
  await this.permission(c,PROCUREMENT_SOURCING_PERMISSIONS.manage);const rfq=await this.rfq(c,rfqId);if(rfq.status!=='SENT')throw new ContractValidationError('status','only bids for an open RFQ may be withdrawn');const bid=await this.repo.findBid(c.companyId,c.branchId,required(bidId,'bidId'));if(!bid||bid.rfqId!==rfq.id)throw new ContractValidationError('bidId','bid was not found for this RFQ');if(bid.status==='WITHDRAWN')return bid;if(bid.status!=='RECEIVED')throw new ContractValidationError('status','only a received bid may be withdrawn');const saved=await this.repo.saveBid({...bid,status:'WITHDRAWN'});await this.access.auditOnce(c,'procurement.sourcing.bid.withdrawn:'+saved.id,'procurement.sourcing.bid.withdrawn','supplier-bid',saved.id);return saved;
 }
 async compare(c:ExecutionContext,rfqId:string):Promise<readonly BidComparisonRow[]>{
  await this.permission(c,PROCUREMENT_SOURCING_PERMISSIONS.read);const rfq=await this.rfq(c,rfqId),req=await this.requisition(c,rfq.requisitionId),requiredLines=new Set(req.lines.map(line=>line.id)),rows=(await this.repo.listBids(c.companyId,c.branchId,rfq.id)).filter(bid=>bid.status==='RECEIVED');
  return rows.map(bid=>{let total=0n;for(const line of bid.lines)total+=scaled(line.quantity)*scaled(line.unitPrice)/SCALE;return{bid,total:decimal(total),complete:bid.lines.length===requiredLines.size&&bid.lines.every(line=>requiredLines.has(line.requisitionLineId))};}).sort((a,b)=>scaled(a.total)<scaled(b.total)?-1:scaled(a.total)>scaled(b.total)?1:a.bid.id.localeCompare(b.bid.id));
 }
 async award(c:ExecutionContext,rfqId:string,bidId:string,reason:string):Promise<SourcingAward>{
  await this.permission(c,PROCUREMENT_SOURCING_PERMISSIONS.award);const rfq=await this.rfq(c,rfqId),existing=await this.repo.findAwardByRfq(c.companyId,c.branchId,rfq.id);if(existing){if(existing.bidId===bidId)return existing;throw new ContractValidationError('award','RFQ already has a different award');}if(rfq.status!=='SENT')throw new ContractValidationError('status','only a sent RFQ may be awarded');const bid=await this.repo.findBid(c.companyId,c.branchId,required(bidId,'bidId'));if(!bid||bid.rfqId!==rfq.id||bid.status!=='RECEIVED')throw new ContractValidationError('bidId','received bid was not found for this RFQ');await this.suppliers.assertUsable(c.companyId,bid.supplierPartyId);const comparison=await this.compare(c,rfq.id),row=comparison.find(value=>value.bid.id===bid.id);if(!row?.complete)throw new ContractValidationError('bid','award requires a complete bid');
  const at=this.now().toISOString(),req=await this.requisition(c,rfq.requisitionId),award:SourcingAward={id:this.newId(),companyId:c.companyId,branchId:c.branchId,requisitionId:req.id,rfqId:rfq.id,bidId:bid.id,supplierPartyId:bid.supplierPartyId,reason:required(reason,'reason'),awardedBy:c.actorId,awardedAt:at,purchaseOrderId:null},allBids=await this.repo.listBids(c.companyId,c.branchId,rfq.id);
  const saved=await this.repo.commitAward({award,requisition:{...req,status:'AWARDED',updatedAt:at},rfq:{...rfq,status:'CLOSED',closedAt:at},bids:allBids.map(value=>({...value,status:value.id===bid.id?'AWARDED':'REJECTED'}))});await this.access.auditOnce(c,'procurement.sourcing.award.created:'+saved.id,'procurement.sourcing.award.created','procurement-award',saved.id,{rfqId:rfq.id,bidId:bid.id,supplierPartyId:bid.supplierPartyId,reason:saved.reason});return saved;
 }
 async createPurchaseOrderFromAward(c:ExecutionContext,awardId:string){
  await this.permission(c,PROCUREMENT_SOURCING_PERMISSIONS.award);const award=await this.repo.findAward(c.companyId,c.branchId,required(awardId,'awardId'));if(!award)throw new ContractValidationError('awardId','award was not found in this company and branch');if(award.purchaseOrderId)return this.procurement.getPurchaseOrder(c.companyId,c.branchId,award.purchaseOrderId);
  const [req,bid]=await Promise.all([this.requisition(c,award.requisitionId),this.repo.findBid(c.companyId,c.branchId,award.bidId)]);if(!bid)throw new ContractValidationError('bidId','awarded bid was not found');await this.suppliers.assertUsable(c.companyId,award.supplierPartyId);const reqLines=new Map(req.lines.map(line=>[line.id,line])),today=this.now().toISOString().slice(0,10),poId='sourcing-'+award.id;
  const po=await this.procurement.createPurchaseOrder({id:poId,companyId:c.companyId,branchId:c.branchId,supplierId:award.supplierPartyId,origin:'AUTO',orderDate:today,...(req.needByDate?{expectedDate:req.needByDate}:{}),currency:bid.currency,externalReference:award.id,notes:'Sourcing award '+award.id,lines:bid.lines.map(line=>{const source=reqLines.get(line.requisitionLineId);if(!source)throw new ContractValidationError('bid','awarded bid contains an unknown requisition line');return{id:'sourcing-line-'+line.id,itemReference:source.itemReference,...(source.description?{description:source.description}:{}),orderedQuantity:line.quantity,unitPrice:line.unitPrice,...(line.taxCode?{taxCode:line.taxCode}:{})};})});
  const updated=await this.repo.updateAward({...award,purchaseOrderId:po.id});await this.repo.updateRequisition({...req,status:'CLOSED',updatedAt:this.now().toISOString()});await this.access.auditOnce(c,'procurement.sourcing.award.po-created:'+updated.id,'procurement.sourcing.purchase-order-created','procurement-award',updated.id,{purchaseOrderId:po.id});return po;
 }
 async listAwards(c:ExecutionContext){await this.permission(c,PROCUREMENT_SOURCING_PERMISSIONS.read);return this.repo.listAwards(c.companyId,c.branchId);}
}
