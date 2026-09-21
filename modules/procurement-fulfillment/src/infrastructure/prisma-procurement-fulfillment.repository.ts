import{Prisma,type PrismaClient}from'@prisma/client';
import{ContractValidationError,companyId,decimalAmount,type CompanyId,type DecimalAmount}from'@elhafez/contracts';
import type{ProcurementFulfillmentRepository}from'../application/procurement-fulfillment.repository.js';
import type{ProcurementFulfillmentRecord}from'../domain/fulfillment.js';

export class PrismaProcurementFulfillmentRepository implements ProcurementFulfillmentRepository{
 constructor(private readonly db:PrismaClient){}
 private value(row:{id:string;companyId:string;branchId:string;purchaseOrderId:string;lineId:string;supplierId:string;kind:string;status:string;requestedQuantity:Prisma.Decimal;previousReceivedQuantity:Prisma.Decimal|null;resultingReceivedQuantity:Prisma.Decimal|null;correctionOfId:string|null;reason:string|null;note:string|null;attachmentIds:Prisma.JsonValue;actorId:string;requestHash:string;createdAt:Date;appliedAt:Date|null}):ProcurementFulfillmentRecord{
  return{id:row.id,companyId:companyId(row.companyId),branchId:row.branchId,purchaseOrderId:row.purchaseOrderId,lineId:row.lineId,supplierId:row.supplierId,kind:row.kind as ProcurementFulfillmentRecord['kind'],status:row.status as ProcurementFulfillmentRecord['status'],requestedQuantity:decimalAmount(row.requestedQuantity.toString()),...(row.previousReceivedQuantity?{previousReceivedQuantity:decimalAmount(row.previousReceivedQuantity.toString())}:{}),...(row.resultingReceivedQuantity?{resultingReceivedQuantity:decimalAmount(row.resultingReceivedQuantity.toString())}:{}),...(row.correctionOfId?{correctionOfId:row.correctionOfId}:{}),...(row.reason?{reason:row.reason}:{}),...(row.note?{note:row.note}:{}),attachmentIds:Array.isArray(row.attachmentIds)?row.attachmentIds.filter((x):x is string=>typeof x==='string'):[],actorId:row.actorId,requestHash:row.requestHash,createdAt:row.createdAt.toISOString(),...(row.appliedAt?{appliedAt:row.appliedAt.toISOString()}: {})};
 }
 async reserve(v:ProcurementFulfillmentRecord){
  const old=await this.db.pfFulfillmentRecord.findUnique({where:{companyId_id:{companyId:v.companyId,id:v.id}}});
  if(old){if(old.requestHash!==v.requestHash)throw new ContractValidationError('id','conflicting fulfillment replay');return this.value(old);}
  const collision=await this.db.pfFulfillmentRecord.findUnique({where:{id:v.id}});
  if(collision)throw new ContractValidationError('id','cross-company fulfillment id collision');
  try{
   const created=await this.db.pfFulfillmentRecord.create({data:{id:v.id,companyId:v.companyId,branchId:v.branchId,purchaseOrderId:v.purchaseOrderId,lineId:v.lineId,supplierId:v.supplierId,kind:v.kind,status:v.status,requestedQuantity:v.requestedQuantity,previousReceivedQuantity:null,resultingReceivedQuantity:null,correctionOfId:v.correctionOfId??null,reason:v.reason??null,note:v.note??null,attachmentIds:[...v.attachmentIds] as Prisma.InputJsonValue,actorId:v.actorId,requestHash:v.requestHash,createdAt:new Date(v.createdAt),appliedAt:null}});
   return this.value(created);
  }catch(error){
   const replay=await this.db.pfFulfillmentRecord.findUnique({where:{companyId_id:{companyId:v.companyId,id:v.id}}});
   if(replay?.requestHash===v.requestHash)return this.value(replay);
   throw error;
  }
 }
 async complete(c:CompanyId,id:string,previousReceivedQuantity:DecimalAmount,resultingReceivedQuantity:DecimalAmount,appliedAt:string){
  return this.db.$transaction(async(tx)=>{
   const old=await tx.pfFulfillmentRecord.findUnique({where:{companyId_id:{companyId:c,id}}});
   if(!old)throw new ContractValidationError('id','fulfillment evidence not found');
   if(old.status==='APPLIED')return this.value(old);
   const updated=await tx.pfFulfillmentRecord.update({where:{companyId_id:{companyId:c,id}},data:{status:'APPLIED',previousReceivedQuantity,resultingReceivedQuantity,appliedAt:new Date(appliedAt)}});
   return this.value(updated);
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
 }
 async find(c:CompanyId,id:string){const row=await this.db.pfFulfillmentRecord.findUnique({where:{companyId_id:{companyId:c,id}}});return row?this.value(row):undefined;}
 async listForPurchaseOrder(c:CompanyId,b:string,po:string){return(await this.db.pfFulfillmentRecord.findMany({where:{companyId:c,branchId:b,purchaseOrderId:po},orderBy:{createdAt:'asc'}})).map((row)=>this.value(row));}
}
