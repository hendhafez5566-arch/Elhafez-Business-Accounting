import{randomUUID}from'node:crypto';import{ContractValidationError,type ExecutionContext}from'@elhafez/contracts';import type{BarcodeAccess,BarcodeBookingPort,BarcodeProviderPort,BarcodeTravelerPort}from'./barcode.ports.js';import type{BarcodeRepository}from'./barcode.repository.js';import{req,type BarcodeHistory,type BarcodeStatus,type UmrahBarcodeRequest}from'../domain/barcode.js';
export const BARCODE_PERMISSIONS=Object.freeze({read:'hajj_umrah.barcode.read',manage:'hajj_umrah.barcode.manage',provider:'hajj_umrah.barcode.provider'});
export class HajjUmrahBarcodeApplicationService{
 constructor(private readonly repo:BarcodeRepository,private readonly bookings:BarcodeBookingPort,private readonly travelers:BarcodeTravelerPort,private readonly provider:BarcodeProviderPort,private readonly access:BarcodeAccess,private readonly now:()=>Date=()=>new Date(),private readonly newId:()=>string=()=>randomUUID()){}
 private async perm(c:ExecutionContext,p:string){await this.access.requireBranch(c);await this.access.requirePermission(c,p)}
 private h(c:ExecutionContext,id:string,action:string,from:BarcodeStatus|null,to:BarcodeStatus,detail:string|null=null):BarcodeHistory{return{id:this.newId(),companyId:c.companyId,branchId:c.branchId,requestId:id,action,fromStatus:from,toStatus:to,detail,actorId:c.actorId,occurredAt:this.now().toISOString()}}
 private async required(c:ExecutionContext,id:string){const v=await this.repo.get(c.companyId,c.branchId,id);if(!v)throw new ContractValidationError('requestId','barcode request not found');return v}
 async create(c:ExecutionContext,bookingId:string,travelerId:string){
  await this.perm(c,BARCODE_PERMISSIONS.manage);
  const booking=await this.bookings.requireOperationalTraveler(c,req(bookingId,'bookingId'),req(travelerId,'travelerId')),passport=await this.travelers.currentPassport(c,travelerId);
  if(!passport)throw new ContractValidationError('passport','current passport is required');
  if(passport.expiryDate&&passport.expiryDate<=this.now().toISOString().slice(0,10))throw new ContractValidationError('passport','passport is expired');
  const prior=await this.repo.findActive(c.companyId,c.branchId,booking.id,travelerId);if(prior)return prior;
  const at=this.now().toISOString(),v:UmrahBarcodeRequest={id:this.newId(),companyId:c.companyId,branchId:c.branchId,bookingId:booking.id,travelerId,passportDocumentId:passport.id,status:'DRAFT',externalReference:null,barcodeValue:null,rejectionReason:null,attempt:0,submittedAt:null,issuedAt:null,createdAt:at,updatedAt:at};
  return this.repo.create(v,this.h(c,v.id,'CREATED',null,'DRAFT'));
 }
 async submit(c:ExecutionContext,id:string){
  await this.perm(c,BARCODE_PERMISSIONS.manage);const old=await this.required(c,id);
  if(old.status==='ISSUED')return old;if(!['DRAFT','REJECTED'].includes(old.status))throw new ContractValidationError('status','request cannot be submitted');
  await this.bookings.requireOperationalTraveler(c,old.bookingId,old.travelerId);const passport=await this.travelers.currentPassport(c,old.travelerId);
  if(!passport||passport.id!==old.passportDocumentId)throw new ContractValidationError('passport','barcode request passport is no longer current');
  const response=await this.provider.submit(c.companyId,{requestId:old.id,bookingId:old.bookingId,travelerId:old.travelerId,passportNumber:passport.documentNumber,passportExpiry:passport.expiryDate}),at=this.now().toISOString(),next:UmrahBarcodeRequest={...old,status:'SUBMITTED',externalReference:req(response.externalReference,'externalReference'),rejectionReason:null,attempt:old.attempt+1,submittedAt:at,updatedAt:at};
  const out=await this.repo.save(next,this.h(c,id,'SUBMITTED',old.status,'SUBMITTED',response.providerStatus??null));await this.access.audit(c,'hajj-umrah.barcode.submitted',id,{externalReference:out.externalReference});return out;
 }
 async recordProviderStatus(c:ExecutionContext,id:string,input:{status:'PROCESSING'|'ISSUED'|'REJECTED';barcodeValue?:string;reason?:string;externalReference?:string}){
  await this.perm(c,BARCODE_PERMISSIONS.provider);const old=await this.required(c,id);
  if(old.status==='ISSUED'){if(input.status==='ISSUED'&&(!input.barcodeValue||input.barcodeValue===old.barcodeValue))return old;throw new ContractValidationError('status','issued barcode is terminal')}
  if(old.status==='CANCELLED')throw new ContractValidationError('status','cancelled request is terminal');
  if(!['SUBMITTED','PROCESSING'].includes(old.status)&&input.status!=='REJECTED')throw new ContractValidationError('status','provider status requires submitted request');
  const at=this.now().toISOString(),barcode=input.status==='ISSUED'?req(input.barcodeValue??'','barcodeValue'):null,reason=input.status==='REJECTED'?req(input.reason??'','reason'):null,next:UmrahBarcodeRequest={...old,status:input.status,externalReference:input.externalReference?.trim()||old.externalReference,barcodeValue:barcode,rejectionReason:reason,issuedAt:input.status==='ISSUED'?at:null,updatedAt:at};
  return this.repo.save(next,this.h(c,id,'PROVIDER_'+input.status,old.status,input.status,reason));
 }
 async cancel(c:ExecutionContext,id:string,reason:string){await this.perm(c,BARCODE_PERMISSIONS.manage);const old=await this.required(c,id);if(old.status==='ISSUED')throw new ContractValidationError('status','issued barcode cannot be cancelled');if(old.status==='CANCELLED')return old;const next={...old,status:'CANCELLED' as const,updatedAt:this.now().toISOString()};return this.repo.save(next,this.h(c,id,'CANCELLED',old.status,'CANCELLED',req(reason,'reason')))}
 async list(c:ExecutionContext){await this.perm(c,BARCODE_PERMISSIONS.read);return this.repo.list(c.companyId,c.branchId)}
 async history(c:ExecutionContext,id:string){await this.perm(c,BARCODE_PERMISSIONS.read);await this.required(c,id);return this.repo.history(c.companyId,c.branchId,id)}
}
