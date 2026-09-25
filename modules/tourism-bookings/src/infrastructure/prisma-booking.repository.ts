import{Prisma,type TbkBooking,type PrismaClient}from'@prisma/client';
import{companyId}from'@elhafez/contracts';
import type{BookingFinancialEvidence,TourismBooking,TourismBookingHistory,TourismBookingStatus}from'../domain/booking.js';
import type{TourismBookingRepository}from'../application/booking.repository.js';

function status(value:string):TourismBookingStatus{switch(value){case'DRAFT':case'CONFIRMING':case'CONFIRMED':case'CANCELLATION_REQUIRED':case'CANCELLED':case'COMPLETED':return value;default:throw new Error('invalid persisted tourism booking status');}}
function travelerIds(value:Prisma.JsonValue):string[]{if(!Array.isArray(value)||!value.every(item=>typeof item==='string'&&item.trim().length>0))throw new Error('invalid persisted tourism booking travelers');return[...value];}
function financialEvidence(value:Prisma.JsonValue|null):BookingFinancialEvidence|undefined{
 if(value===null)return undefined;if(typeof value!=='object'||Array.isArray(value))throw new Error('invalid persisted tourism booking financial evidence');
 const workflowId=value.workflowId,invoiceId=value.invoiceId,allocationIds=value.allocationIds,commissionClaimId=value.commissionClaimId;
 if(typeof workflowId!=='string'||!workflowId||!Array.isArray(allocationIds)||!allocationIds.every(item=>typeof item==='string'))throw new Error('invalid persisted tourism booking financial evidence');
 if(invoiceId!==undefined&&invoiceId!==null&&typeof invoiceId!=='string')throw new Error('invalid persisted tourism booking invoice reference');
 if(commissionClaimId!==undefined&&commissionClaimId!==null&&typeof commissionClaimId!=='string')throw new Error('invalid persisted tourism booking commission reference');
 return{workflowId,...(typeof invoiceId==='string'?{invoiceId}:{}),allocationIds:[...allocationIds],...(typeof commissionClaimId==='string'?{commissionClaimId}:{})};
}
function evidenceJson(value:BookingFinancialEvidence|undefined):Prisma.InputJsonValue|typeof Prisma.JsonNull{
 return value?{workflowId:value.workflowId,...(value.invoiceId?{invoiceId:value.invoiceId}:{}),allocationIds:[...value.allocationIds],...(value.commissionClaimId?{commissionClaimId:value.commissionClaimId}:{})}:Prisma.JsonNull;
}
function map(x:TbkBooking):TourismBooking{const evidence=financialEvidence(x.financialEvidence);return{id:x.id,companyId:companyId(x.companyId),branchId:x.branchId,code:x.code,programId:x.programId,customerId:x.customerId,customerPartyId:x.customerPartyId,travelerIds:travelerIds(x.travelerIds),status:status(x.status),...(x.pendingCommandKey?{pendingCommandKey:x.pendingCommandKey}:{}),...(evidence?{financialEvidence:evidence}:{}),revision:x.revision,createdAt:x.createdAt.toISOString(),updatedAt:x.updatedAt.toISOString()};}
export class PrismaTourismBookingRepository implements TourismBookingRepository{
 constructor(private readonly db:PrismaClient){}
 private data(v:TourismBooking){return{companyId:v.companyId,branchId:v.branchId,code:v.code,programId:v.programId,customerId:v.customerId,customerPartyId:v.customerPartyId,travelerIds:[...v.travelerIds],status:v.status,pendingCommandKey:v.pendingCommandKey??null,financialEvidence:evidenceJson(v.financialEvidence),revision:v.revision,createdAt:new Date(v.createdAt),updatedAt:new Date(v.updatedAt)}}
 private h(v:TourismBookingHistory){return{id:v.id,companyId:v.companyId,branchId:v.branchId,bookingId:v.bookingId,action:v.action,actorId:v.actorId,occurredAt:new Date(v.occurredAt)}}
 async create(v:TourismBooking,h:TourismBookingHistory){await this.db.$transaction([this.db.tbkBooking.create({data:{id:v.id,...this.data(v)}}),this.db.tbkBookingHistory.create({data:this.h(h)})]);return v}
 async save(v:TourismBooking,h:TourismBookingHistory){await this.db.$transaction(async tx=>{const updated=await tx.tbkBooking.updateMany({where:{id:v.id,companyId:v.companyId,branchId:v.branchId,revision:v.revision-1},data:this.data(v)});if(updated.count!==1)throw new Error('booking revision changed');await tx.tbkBookingHistory.create({data:this.h(h)});});return v}
 async get(c:string,b:string,id:string){const x=await this.db.tbkBooking.findFirst({where:{id,companyId:c,branchId:b}});return x?map(x):null}
 async list(c:string,b:string,s?:TourismBookingStatus){return(await this.db.tbkBooking.findMany({where:{companyId:c,branchId:b,...(s?{status:s}:{})},orderBy:{createdAt:'desc'}})).map(map)}
 async listForProgram(c:string,b:string,p:string){return(await this.db.tbkBooking.findMany({where:{companyId:c,branchId:b,programId:p},orderBy:{createdAt:'desc'}})).map(map)}
}
