import{Body,Controller,Get,Headers,Param,Patch,Post,UnauthorizedException}from'@nestjs/common';
import{executionContext,type ExecutionContext}from'@elhafez/contracts';
import{PlatformCoreApplicationService}from'@elhafez/platform-core';
import{
 ProcurementFulfillmentApplicationService,
 type ConvertPurchaseOrderLineToSupplierInvoiceInput,
 type CorrectFulfillmentInput,
 type CreateDirectPurchaseOperationalInput,
 type CreateManualPurchaseOrderInput,
 type RecordFulfillmentInput,
 type UpdateManualPurchaseOrderInput,
}from'../application/procurement-fulfillment.application-service.js';

@Controller('procurement')
export class ProcurementOperationsController{
 static readonly runtimeDependencies=[ProcurementFulfillmentApplicationService,PlatformCoreApplicationService]as const;
 constructor(private readonly service:ProcurementFulfillmentApplicationService,private readonly platform:PlatformCoreApplicationService){}

 @Get('purchase-orders')
 async list(@Headers('authorization')a:string|undefined,@Headers('x-company-id')c:string|undefined,@Headers('x-branch-id')b:string|undefined){
  return this.service.listPurchaseOrders(await this.context(a,c,b));
 }

 @Post('purchase-orders')
 async create(@Headers('authorization')a:string|undefined,@Headers('x-company-id')c:string|undefined,@Headers('x-branch-id')b:string|undefined,@Body()input:CreateManualPurchaseOrderInput){
  return this.service.createPurchaseOrder(await this.context(a,c,b),input);
 }

 @Get('purchase-orders/:id')
 async get(@Headers('authorization')a:string|undefined,@Headers('x-company-id')c:string|undefined,@Headers('x-branch-id')b:string|undefined,@Param('id')id:string){
  return this.service.getPurchaseOrder(await this.context(a,c,b),id);
 }

 @Patch('purchase-orders/:id')
 async update(@Headers('authorization')a:string|undefined,@Headers('x-company-id')c:string|undefined,@Headers('x-branch-id')b:string|undefined,@Param('id')id:string,@Body()input:Omit<UpdateManualPurchaseOrderInput,'purchaseOrderId'>){
  return this.service.updateDraftPurchaseOrder(await this.context(a,c,b),{...input,purchaseOrderId:id});
 }

 @Post('purchase-orders/:id/approve')
 async approve(@Headers('authorization')a:string|undefined,@Headers('x-company-id')c:string|undefined,@Headers('x-branch-id')b:string|undefined,@Param('id')id:string){
  return this.service.approvePurchaseOrder(await this.context(a,c,b),id);
 }

 @Post('purchase-orders/:id/cancel')
 async cancel(@Headers('authorization')a:string|undefined,@Headers('x-company-id')c:string|undefined,@Headers('x-branch-id')b:string|undefined,@Param('id')id:string,@Body()input:{reason:string}){
  return this.service.cancelPurchaseOrder(await this.context(a,c,b),id,input.reason);
 }

 @Post('purchase-orders/:id/fulfillments')
 async fulfill(@Headers('authorization')a:string|undefined,@Headers('x-company-id')c:string|undefined,@Headers('x-branch-id')b:string|undefined,@Param('id')id:string,@Body()input:Omit<RecordFulfillmentInput,'purchaseOrderId'>){
  return this.service.recordFulfillment(await this.context(a,c,b),{...input,purchaseOrderId:id});
 }

 @Post('purchase-orders/:id/fulfillment-corrections')
 async correct(@Headers('authorization')a:string|undefined,@Headers('x-company-id')c:string|undefined,@Headers('x-branch-id')b:string|undefined,@Param('id')id:string,@Body()input:Omit<CorrectFulfillmentInput,'purchaseOrderId'>){
  return this.service.correctFulfillment(await this.context(a,c,b),{...input,purchaseOrderId:id});
 }

 @Post('purchase-orders/:id/lines/:lineId/supplier-invoices')
 async invoice(@Headers('authorization')a:string|undefined,@Headers('x-company-id')c:string|undefined,@Headers('x-branch-id')b:string|undefined,@Param('id')id:string,@Param('lineId')lineId:string,@Body()input:Omit<ConvertPurchaseOrderLineToSupplierInvoiceInput,'purchaseOrderId'|'lineId'>){
  return this.service.convertPurchaseOrderLineToSupplierInvoice(await this.context(a,c,b),{...input,purchaseOrderId:id,lineId});
 }

 @Get('purchase-orders/:id/fulfillments')
 async fulfillments(@Headers('authorization')a:string|undefined,@Headers('x-company-id')c:string|undefined,@Headers('x-branch-id')b:string|undefined,@Param('id')id:string){
  return this.service.listFulfillment(await this.context(a,c,b),id);
 }

 @Post('direct-purchases')
 async direct(@Headers('authorization')a:string|undefined,@Headers('x-company-id')c:string|undefined,@Headers('x-branch-id')b:string|undefined,@Body()input:CreateDirectPurchaseOperationalInput){
  return this.service.createDirectPurchase(await this.context(a,c,b),input);
 }

 private async context(authorization:string|undefined,companyId:string|undefined,branchId:string|undefined):Promise<ExecutionContext>{
  if(!authorization?.startsWith('Bearer ')||!companyId||!branchId)throw new UnauthorizedException('authenticated company and branch context required');
  const user=await this.platform.currentUser(authorization.slice(7));
  return executionContext(companyId,branchId,user.id);
 }
}
