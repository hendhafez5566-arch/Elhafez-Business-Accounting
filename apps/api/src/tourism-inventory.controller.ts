import { Body, Controller, Get, Headers, Inject, Param, Post, Query, UnauthorizedException } from '@nestjs/common';
import { decimalAmount, executionContext, type ExecutionContext } from '@elhafez/contracts';
import type { ContractType, ServiceCategory, TourismContractInventoryApplicationService } from '@elhafez/tourism-contract-inventory';
import { TOURISM_CONTRACT_INVENTORY_SERVICE } from '@elhafez/tourism-contract-inventory/nest';
import { PlatformCoreApplicationService, PlatformError } from '@elhafez/platform-core';

export const TOURISM_INVENTORY_PERMISSIONS=Object.freeze({view:'tourism.inventory.view',manage:'tourism.inventory.manage'} as const);
type H={authorization?:string;companyId?:string;branchId?:string};

@Controller('tourism/inventory')
export class TourismInventoryController {
  constructor(
    @Inject(TOURISM_CONTRACT_INVENTORY_SERVICE) private readonly inventory:TourismContractInventoryApplicationService,
    private readonly platform:PlatformCoreApplicationService,
  ){}

  private async context(headers:H,permission:string):Promise<ExecutionContext>{
    if(!headers.authorization?.startsWith('Bearer ')||!headers.companyId||!headers.branchId)throw new UnauthorizedException('authenticated company and branch context required');
    const user=await this.platform.currentUser(headers.authorization.slice(7));
    const context=executionContext(headers.companyId,headers.branchId,user.id);
    await this.platform.requireBranchAccess(user.id,context.companyId,context.branchId);
    await this.platform.authorize(user.id,context.companyId,permission);
    return context;
  }

  @Get('capabilities')
  async capabilities(@Headers('authorization')authorization?:string,@Headers('x-company-id')companyId?:string,@Headers('x-branch-id')branchId?:string){
    const c=await this.context({authorization,companyId,branchId},TOURISM_INVENTORY_PERMISSIONS.view);
    try{await this.platform.authorize(c.actorId,c.companyId,TOURISM_INVENTORY_PERMISSIONS.manage);return{view:true,manage:true};}
    catch(error){if(error instanceof PlatformError&&error.code==='FORBIDDEN')return{view:true,manage:false};throw error;}
  }

  @Get()
  async overview(@Headers('authorization')authorization?:string,@Headers('x-company-id')companyId?:string,@Headers('x-branch-id')branchId?:string,@Query('contractId')contractId?:string){
    const c=await this.context({authorization,companyId,branchId},TOURISM_INVENTORY_PERMISSIONS.view);
    const[contracts,stock]=await Promise.all([this.inventory.listContracts(c.companyId),this.inventory.inventoryOverview(c.companyId,contractId?.trim()||undefined)]);
    return{contracts,...stock};
  }

  @Post('contracts')
  async createContract(@Headers('authorization')authorization:string,@Headers('x-company-id')companyId:string,@Headers('x-branch-id')branchId:string,@Body()body:{type:ContractType;supplierId?:string;effectiveFrom:string;effectiveTo:string}){
    const c=await this.context({authorization,companyId,branchId},TOURISM_INVENTORY_PERMISSIONS.manage);
    return this.inventory.createContract({companyId:c.companyId,type:body.type,...(body.supplierId?.trim()?{supplierId:body.supplierId.trim()}:{}),effectiveFrom:body.effectiveFrom,effectiveTo:body.effectiveTo},'ui-contract:'+cryptoKey(body));
  }

  @Post('contracts/:id/amend')
  async amendContract(@Headers('authorization')authorization:string,@Headers('x-company-id')companyId:string,@Headers('x-branch-id')branchId:string,@Param('id')id:string,@Body()body:{terms:Record<string,unknown>;effectiveFrom:string;effectiveTo?:string}){
    const c=await this.context({authorization,companyId,branchId},TOURISM_INVENTORY_PERMISSIONS.manage);
    return this.inventory.amendContract({companyId:c.companyId,contractId:id,terms:body.terms,effectiveFrom:body.effectiveFrom,...(body.effectiveTo?.trim()?{effectiveTo:body.effectiveTo.trim()}:{})},'ui-amend:'+id+':'+body.effectiveFrom);
  }

  @Post('hotels')
  async createHotel(@Headers('authorization')authorization:string,@Headers('x-company-id')companyId:string,@Headers('x-branch-id')branchId:string,@Body()body:{contractId:string;hotelId:string;roomId?:string;serviceDate:string;contractedQuantity:string}){
    const c=await this.context({authorization,companyId,branchId},TOURISM_INVENTORY_PERMISSIONS.manage);
    return this.inventory.createHotelInventory({companyId:c.companyId,contractId:body.contractId,hotelId:body.hotelId,...(body.roomId?.trim()?{roomId:body.roomId.trim()}:{}),serviceDate:body.serviceDate,contractedQuantity:decimalAmount(body.contractedQuantity)},'ui-hotel:'+body.contractId+':'+body.hotelId+':'+body.serviceDate+':'+(body.roomId??''));
  }

  @Post('flights')
  async createFlight(@Headers('authorization')authorization:string,@Headers('x-company-id')companyId:string,@Headers('x-branch-id')branchId:string,@Body()body:{contractId:string;flightNumber:string;origin:string;destination:string;departureDate:string;totalSeats:string}){
    const c=await this.context({authorization,companyId,branchId},TOURISM_INVENTORY_PERMISSIONS.manage);
    return this.inventory.createFlightBlock({companyId:c.companyId,contractId:body.contractId,flightNumber:body.flightNumber,origin:body.origin,destination:body.destination,departureDate:body.departureDate,totalSeats:decimalAmount(body.totalSeats)},'ui-flight:'+body.contractId+':'+body.flightNumber+':'+body.departureDate);
  }

  @Post('transport')
  async createTransport(@Headers('authorization')authorization:string,@Headers('x-company-id')companyId:string,@Headers('x-branch-id')branchId:string,@Body()body:{contractId:string;vehicleId:string;capacityUnits:string;periodStart:string;periodEnd:string}){
    const c=await this.context({authorization,companyId,branchId},TOURISM_INVENTORY_PERMISSIONS.manage);
    return this.inventory.createTransportCapacity({companyId:c.companyId,contractId:body.contractId,vehicleId:body.vehicleId,capacityUnits:decimalAmount(body.capacityUnits),periodStart:body.periodStart,periodEnd:body.periodEnd},'ui-transport:'+body.contractId+':'+body.vehicleId+':'+body.periodStart);
  }

  @Post('visas')
  async createVisa(@Headers('authorization')authorization:string,@Headers('x-company-id')companyId:string,@Headers('x-branch-id')branchId:string,@Body()body:{contractId:string;visaType:string;nationality?:string;quotaTotal:string;effectiveFrom:string;effectiveTo:string}){
    const c=await this.context({authorization,companyId,branchId},TOURISM_INVENTORY_PERMISSIONS.manage);
    return this.inventory.createVisaQuota({companyId:c.companyId,contractId:body.contractId,visaType:body.visaType,...(body.nationality?.trim()?{nationality:body.nationality.trim()}:{}),quotaTotal:decimalAmount(body.quotaTotal),effectiveFrom:body.effectiveFrom,effectiveTo:body.effectiveTo},'ui-visa:'+body.contractId+':'+body.visaType+':'+body.effectiveFrom+':'+(body.nationality??''));
  }

  @Post('services')
  async createService(@Headers('authorization')authorization:string,@Headers('x-company-id')companyId:string,@Headers('x-branch-id')branchId:string,@Body()body:{contractId:string;category:ServiceCategory;name:string;description?:string;unit:string;serviceStart:string;serviceEnd:string;capacity:string;releaseDeadline?:string}){
    const c=await this.context({authorization,companyId,branchId},TOURISM_INVENTORY_PERMISSIONS.manage);
    return this.inventory.createGenericService({companyId:c.companyId,contractId:body.contractId,category:body.category,name:body.name,...(body.description?.trim()?{description:body.description.trim()}:{}),unit:body.unit,serviceStart:body.serviceStart,serviceEnd:body.serviceEnd,capacity:decimalAmount(body.capacity),...(body.releaseDeadline?.trim()?{releaseDeadline:body.releaseDeadline.trim()}:{})},'ui-service-stock:'+body.contractId+':'+body.name+':'+body.serviceStart);
  }

  @Post('stop-sales')
  async createStopSale(@Headers('authorization')authorization:string,@Headers('x-company-id')companyId:string,@Headers('x-branch-id')branchId:string,@Body()body:{contractId:string;reason:string;effectiveFrom:string;effectiveTo:string}){
    const c=await this.context({authorization,companyId,branchId},TOURISM_INVENTORY_PERMISSIONS.manage);
    return this.inventory.createStopSale({companyId:c.companyId,contractId:body.contractId,reason:body.reason,effectiveFrom:body.effectiveFrom,effectiveTo:body.effectiveTo},'ui-stop:'+body.contractId+':'+body.effectiveFrom+':'+body.effectiveTo);
  }

  @Post('allocations/:id/release')
  async releaseAllocation(@Headers('authorization')authorization:string,@Headers('x-company-id')companyId:string,@Headers('x-branch-id')branchId:string,@Param('id')id:string,@Body()body:{quantity:string}){
    const c=await this.context({authorization,companyId,branchId},TOURISM_INVENTORY_PERMISSIONS.manage);
    return this.inventory.releaseAllocation({companyId:c.companyId,allocationId:id,quantity:decimalAmount(body.quantity)},'ui-release:'+id+':'+body.quantity);
  }
}

function cryptoKey(value:unknown):string{
  return Buffer.from(JSON.stringify(value)).toString('base64url').slice(0,96);
}
