import { randomUUID } from 'node:crypto';
import { Body, Controller, Get, Headers, Inject, Param, Post, UnauthorizedException } from '@nestjs/common';
import {
  currencyCode,
  decimalAmount,
  executionContext,
  sourceReference,
  type ExecutionContext,
} from '@elhafez/contracts';
import {
  PLATFORM_CORE_PERMISSIONS,
  PlatformCoreApplicationService,
  PlatformError,
} from '@elhafez/platform-core';
import {
  CurrencyFxApplicationService,
} from '@elhafez/currency-fx';
import {
  CostBudgetAccountingApplicationService,
  costCenterId,
} from '@elhafez/cost-budget-accounting';
import { PartyAccountingApplicationService } from '@elhafez/party-accounting';
import { ExpenseCommissionRecognitionApplicationService } from '@elhafez/expense-commission-recognition';
import { AssetsFinancingApplicationService } from '@elhafez/assets-financing';
import type {
  ContractType,
  ResourceType,
  ServiceCategory,
  TourismContractInventoryApplicationService,
} from '@elhafez/tourism-contract-inventory';
import { TOURISM_CONTRACT_INVENTORY_SERVICE } from '@elhafez/tourism-contract-inventory/nest';

type HeaderContext={authorization?:string;companyId?:string;branchId?:string};
type CurrencyInput={code:string;precision:number;isBase:boolean;status:'ACTIVE'|'INACTIVE'};
type RateInput={id:string;fromCurrency:string;toCurrency:string;effectiveAt:string;rate:string;source:string};
type CostCenterInput={id:string;code:string;name:string;parentId?:string};
type BudgetInput={id:string;costCenterId:string;periodStart:string;periodEnd:string;currency:string;amount:string};
type PartyGroupInput={id:string;name:string;members:Array<{id:string;role:'CUSTOMER'|'SUPPLIER'|'AGENT';partyId:string}>};
type NettingInput={id:string;groupId:string;customerInvoiceId:string;supplierInvoiceId:string;amount:string;postingDate:string;number:string;approvalRequestId?:string};
type ExpenseInput={id:string;form:'DIRECT_PAID'|'SUPPLIER_PAYABLE'|'PREPAID'|'CANCELLATION_PENALTY';sourceType:string;sourceId:string;currency:string;amount:string;baseAmount:string;expenseAccountId?:string;prepaidAccountId?:string;billingInvoiceId?:string;approvalRequestId?:string};
type CommissionInput={id:string;agentPartyId:string;sourceType:string;sourceId:string;currency:string;amount:string;baseCarryingAmount:string;expenseAccountId:string;liabilityAccountId:string;approvalRequestId?:string};
type AssetInput={id:string;code:string;name:string;description?:string;acquisitionValue:string;baseValue:string;currency:string;acquisitionDate:string;capitalizationDate:string;inServiceDate:string;residualValue:string;usefulLifeMonths:number;assetAccountId:string;capitalizationOffsetAccountId:string;accumulatedDepreciationAccountId:string;depreciationExpenseAccountId:string;disposalGainAccountId?:string;disposalLossAccountId?:string;number:string};
type LoanInput={id:string;lenderId:string;reference:string;principal:string;currency:string;baseAmount:string;liabilityAccountId:string;interestExpenseAccountId:string;fundingTreasuryId:string;postingDate:string;number:string;installments:Array<{id:string;dueDate:string;principal:string;interest:string}>};
type ContractInput={type:ContractType;supplierId?:string;effectiveFrom:string;effectiveTo:string;sourceType?:string;sourceId?:string};
type InventoryResourceInput={
  contractId:string;kind:'HOTEL'|'FLIGHT'|'TRANSPORT'|'VISA'|'SERVICE';
  hotelId?:string;roomId?:string;serviceDate?:string;contractedQuantity?:string;
  flightNumber?:string;origin?:string;destination?:string;departureDate?:string;totalSeats?:string;
  vehicleId?:string;capacityUnits?:string;periodStart?:string;periodEnd?:string;
  visaType?:string;nationality?:string;quotaTotal?:string;effectiveFrom?:string;effectiveTo?:string;
  category?:ServiceCategory;name?:string;description?:string;unit?:string;serviceStart?:string;serviceEnd?:string;capacity?:string;releaseDeadline?:string;
};
type AvailabilityInput={contractId:string;resourceType:ResourceType;resourceId:string;serviceDate:string;periodEnd?:string};
type AllocationInput={contractId:string;resourceType:ContractType;resourceId:string;programSourceType:string;programSourceId:string;serviceDate:string;periodEnd?:string;quantity:string};

@Controller('advanced')
export class AdvancedOperationsController {
  constructor(
    @Inject(PlatformCoreApplicationService) private readonly platform:PlatformCoreApplicationService,
    @Inject(CurrencyFxApplicationService) private readonly fx:CurrencyFxApplicationService,
    @Inject(CostBudgetAccountingApplicationService) private readonly costs:CostBudgetAccountingApplicationService,
    @Inject(PartyAccountingApplicationService) private readonly parties:PartyAccountingApplicationService,
    @Inject(ExpenseCommissionRecognitionApplicationService) private readonly ecr:ExpenseCommissionRecognitionApplicationService,
    @Inject(AssetsFinancingApplicationService) private readonly assets:AssetsFinancingApplicationService,
    @Inject(TOURISM_CONTRACT_INVENTORY_SERVICE) private readonly inventory:TourismContractInventoryApplicationService,
  ) {}

  private headers(authorization?:string,companyId?:string,branchId?:string):HeaderContext{return{authorization,companyId,branchId};}
  private async context(headers:HeaderContext,operate=true):Promise<ExecutionContext>{
    if(!headers.authorization?.startsWith('Bearer ')||!headers.companyId||!headers.branchId)throw new UnauthorizedException('authenticated company and branch context required');
    const user=await this.platform.currentUser(headers.authorization.slice(7));
    const context=executionContext(headers.companyId,headers.branchId,user.id);
    await this.platform.requireBranchAccess(user.id,context.companyId,context.branchId);
    await this.platform.authorize(user.id,context.companyId,operate?PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate:PLATFORM_CORE_PERMISSIONS.accountingFinanceRead);
    return context;
  }
  private async inventoryContext(headers:HeaderContext,operate=true):Promise<ExecutionContext>{
    if(!headers.authorization?.startsWith('Bearer ')||!headers.companyId||!headers.branchId)throw new UnauthorizedException('authenticated company and branch context required');
    const user=await this.platform.currentUser(headers.authorization.slice(7));
    const context=executionContext(headers.companyId,headers.branchId,user.id);
    await this.platform.requireBranchAccess(user.id,context.companyId,context.branchId);
    const primary=operate?'tourism.services.manage':'tourism.services.view';
    const fallback=operate?'hajj_umrah.programs.edit':'hajj_umrah.programs.view';
    try{await this.platform.authorize(user.id,context.companyId,primary);}
    catch(error){
      if(!(error instanceof PlatformError)||error.code!=='FORBIDDEN')throw error;
      await this.platform.authorize(user.id,context.companyId,fallback);
    }
    return context;
  }

  @Get('currency/base')
  async baseCurrency(@Headers('authorization')a?:string,@Headers('x-company-id')c?:string,@Headers('x-branch-id')b?:string){
    const ctx=await this.context(this.headers(a,c,b),false);return this.fx.getBaseCurrency(ctx.companyId);
  }
  @Post('currency/configure')
  async configureCurrency(@Headers('authorization')a:string,@Headers('x-company-id')c:string,@Headers('x-branch-id')b:string,@Body()x:CurrencyInput){
    const ctx=await this.context(this.headers(a,c,b));return this.fx.configure({companyId:ctx.companyId,code:currencyCode(x.code),precision:x.precision,isBase:x.isBase,status:x.status});
  }
  @Post('currency/rates')
  async publishRate(@Headers('authorization')a:string,@Headers('x-company-id')c:string,@Headers('x-branch-id')b:string,@Body()x:RateInput){
    const ctx=await this.context(this.headers(a,c,b));return this.fx.publishRate({id:x.id,companyId:ctx.companyId,fromCurrency:currencyCode(x.fromCurrency),toCurrency:currencyCode(x.toCurrency),effectiveAt:x.effectiveAt,rate:decimalAmount(x.rate),source:x.source});
  }
  @Post('currency/resolve')
  async resolveRate(@Headers('authorization')a:string,@Headers('x-company-id')c:string,@Headers('x-branch-id')b:string,@Body()x:{fromCurrency:string;toCurrency:string;at:string}){
    const ctx=await this.context(this.headers(a,c,b),false);return this.fx.resolveRate(ctx.companyId,currencyCode(x.fromCurrency),currencyCode(x.toCurrency),x.at);
  }

  @Post('cost-centers')
  async createCostCenter(@Headers('authorization')a:string,@Headers('x-company-id')c:string,@Headers('x-branch-id')b:string,@Body()x:CostCenterInput){
    const ctx=await this.context(this.headers(a,c,b));return this.costs.create({id:costCenterId(x.id),companyId:ctx.companyId,code:x.code,name:x.name,status:'ACTIVE',...(x.parentId?{parentId:costCenterId(x.parentId)}:{})});
  }
  @Get('cost-centers/:id')
  async getCostCenter(@Headers('authorization')a:string,@Headers('x-company-id')c:string,@Headers('x-branch-id')b:string,@Param('id')id:string){
    const ctx=await this.context(this.headers(a,c,b),false);return this.costs.get(ctx.companyId,costCenterId(id));
  }
  @Post('cost-centers/:id/deactivate')
  async deactivateCostCenter(@Headers('authorization')a:string,@Headers('x-company-id')c:string,@Headers('x-branch-id')b:string,@Param('id')id:string){
    const ctx=await this.context(this.headers(a,c,b));return this.costs.deactivate(ctx.companyId,costCenterId(id));
  }
  @Post('budgets')
  async createBudget(@Headers('authorization')a:string,@Headers('x-company-id')c:string,@Headers('x-branch-id')b:string,@Body()x:BudgetInput){
    const ctx=await this.context(this.headers(a,c,b));return this.costs.createBudget({id:x.id,companyId:ctx.companyId,costCenterId:costCenterId(x.costCenterId),periodStart:x.periodStart,periodEnd:x.periodEnd,currency:x.currency,amount:decimalAmount(x.amount)});
  }
  @Post('budgets/:id/authorize')
  async authorizeBudget(@Headers('authorization')a:string,@Headers('x-company-id')c:string,@Headers('x-branch-id')b:string,@Param('id')id:string){
    const ctx=await this.context(this.headers(a,c,b));return this.costs.authorizeBudget(ctx.companyId,id);
  }
  @Get('budgets/:id/check')
  async checkBudget(@Headers('authorization')a:string,@Headers('x-company-id')c:string,@Headers('x-branch-id')b:string,@Param('id')id:string){
    const ctx=await this.context(this.headers(a,c,b),false);return this.costs.checkBudget(ctx.companyId,id);
  }

  @Post('party-groups')
  async createPartyGroup(@Headers('authorization')a:string,@Headers('x-company-id')c:string,@Headers('x-branch-id')b:string,@Body()x:PartyGroupInput){
    const ctx=await this.context(this.headers(a,c,b));return this.parties.createGroup({id:x.id,companyId:ctx.companyId,name:x.name,members:x.members});
  }
  @Post('nettings')
  async proposeNetting(@Headers('authorization')a:string,@Headers('x-company-id')c:string,@Headers('x-branch-id')b:string,@Body()x:NettingInput){
    const ctx=await this.context(this.headers(a,c,b));return this.parties.proposeNetting({id:x.id,companyId:ctx.companyId,branchId:ctx.branchId,groupId:x.groupId,customerInvoiceId:x.customerInvoiceId,supplierInvoiceId:x.supplierInvoiceId,amount:decimalAmount(x.amount),postingDate:x.postingDate,number:x.number,requesterActorId:ctx.actorId,...(x.approvalRequestId?{approvalRequestId:x.approvalRequestId}:{})});
  }
  @Post('nettings/:id/execute')
  async executeNetting(@Headers('authorization')a:string,@Headers('x-company-id')c:string,@Headers('x-branch-id')b:string,@Param('id')id:string){
    const ctx=await this.context(this.headers(a,c,b));return this.parties.executeNetting(ctx.companyId,id);
  }
  @Post('nettings/:id/reverse')
  async reverseNetting(@Headers('authorization')a:string,@Headers('x-company-id')c:string,@Headers('x-branch-id')b:string,@Param('id')id:string,@Body()x:{postingDate:string;number:string}){
    const ctx=await this.context(this.headers(a,c,b));return this.parties.reverseNetting(ctx.companyId,id,x.postingDate,x.number);
  }

  @Post('expenses')
  async createExpense(@Headers('authorization')a:string,@Headers('x-company-id')c:string,@Headers('x-branch-id')b:string,@Body()x:ExpenseInput){
    const ctx=await this.context(this.headers(a,c,b));return this.ecr.createExpense({id:x.id,companyId:ctx.companyId,branchId:ctx.branchId,form:x.form,sourceType:x.sourceType,sourceId:x.sourceId,currency:x.currency,amount:decimalAmount(x.amount),baseAmount:decimalAmount(x.baseAmount),...(x.expenseAccountId?{expenseAccountId:x.expenseAccountId}:{}),...(x.prepaidAccountId?{prepaidAccountId:x.prepaidAccountId}:{}),...(x.billingInvoiceId?{billingInvoiceId:x.billingInvoiceId}:{}),...(x.approvalRequestId?{approvalRequestId:x.approvalRequestId}:{})});
  }
  @Post('expenses/:id/pay')
  async payExpense(@Headers('authorization')a:string,@Headers('x-company-id')c:string,@Headers('x-branch-id')b:string,@Param('id')id:string,@Body()x:{treasuryId:string;paymentCurrency:string;postingDate:string;number:string;realizedFxGainAccountId?:string;realizedFxLossAccountId?:string}){
    const ctx=await this.context(this.headers(a,c,b));return this.ecr.postPaidExpense({companyId:ctx.companyId,expenseId:id,actorId:ctx.actorId,...x});
  }
  @Post('commissions')
  async createCommission(@Headers('authorization')a:string,@Headers('x-company-id')c:string,@Headers('x-branch-id')b:string,@Body()x:CommissionInput){
    const ctx=await this.context(this.headers(a,c,b));return this.ecr.createCommissionClaim({id:x.id,companyId:ctx.companyId,branchId:ctx.branchId,agentPartyId:x.agentPartyId,sourceType:x.sourceType,sourceId:x.sourceId,currency:x.currency,amount:decimalAmount(x.amount),baseCarryingAmount:decimalAmount(x.baseCarryingAmount),expenseAccountId:x.expenseAccountId,liabilityAccountId:x.liabilityAccountId,requesterActorId:ctx.actorId,...(x.approvalRequestId?{approvalRequestId:x.approvalRequestId}:{})});
  }
  @Post('commissions/:id/approve')
  async approveCommission(@Headers('authorization')a:string,@Headers('x-company-id')c:string,@Headers('x-branch-id')b:string,@Param('id')id:string,@Body()x:{postingDate:string;number:string}){
    const ctx=await this.context(this.headers(a,c,b));return this.ecr.approveCommission(ctx.companyId,id,x.postingDate,x.number);
  }
  @Post('commissions/:id/pay')
  async payCommission(@Headers('authorization')a:string,@Headers('x-company-id')c:string,@Headers('x-branch-id')b:string,@Param('id')id:string,@Body()x:{paymentId:string;treasuryId:string;amount:string;paymentCurrency:string;postingDate:string;number:string;realizedFxGainAccountId?:string;realizedFxLossAccountId?:string}){
    const ctx=await this.context(this.headers(a,c,b));return this.ecr.payCommission({companyId:ctx.companyId,claimId:id,paymentId:x.paymentId,treasuryId:x.treasuryId,amount:decimalAmount(x.amount),paymentCurrency:x.paymentCurrency,postingDate:x.postingDate,number:x.number,...(x.realizedFxGainAccountId?{realizedFxGainAccountId:x.realizedFxGainAccountId}:{}),...(x.realizedFxLossAccountId?{realizedFxLossAccountId:x.realizedFxLossAccountId}:{})});
  }

  @Post('assets')
  async registerAsset(@Headers('authorization')a:string,@Headers('x-company-id')c:string,@Headers('x-branch-id')b:string,@Body()x:AssetInput){
    const ctx=await this.context(this.headers(a,c,b));return this.assets.registerAsset({...x,companyId:ctx.companyId,acquisitionValue:decimalAmount(x.acquisitionValue),baseValue:decimalAmount(x.baseValue),residualValue:decimalAmount(x.residualValue)});
  }
  @Post('assets/:id/depreciation')
  async depreciate(@Headers('authorization')a:string,@Headers('x-company-id')c:string,@Headers('x-branch-id')b:string,@Param('id')id:string,@Body()x:{movementId:string;period:number;postingDate:string;number:string}){
    const ctx=await this.context(this.headers(a,c,b));return this.assets.postDepreciation({id:x.movementId,companyId:ctx.companyId,assetId:id,period:x.period,postingDate:x.postingDate,number:x.number});
  }
  @Post('loans')
  async originateLoan(@Headers('authorization')a:string,@Headers('x-company-id')c:string,@Headers('x-branch-id')b:string,@Body()x:LoanInput){
    const ctx=await this.context(this.headers(a,c,b));return this.assets.originateLoan({...x,companyId:ctx.companyId,principal:decimalAmount(x.principal),baseAmount:decimalAmount(x.baseAmount),installments:x.installments.map(v=>({...v,principal:decimalAmount(v.principal),interest:decimalAmount(v.interest)}))});
  }
  @Post('loans/:loanId/installments/:installmentId/pay')
  async payLoanInstallment(@Headers('authorization')a:string,@Headers('x-company-id')c:string,@Headers('x-branch-id')b:string,@Param('loanId')loanId:string,@Param('installmentId')installmentId:string,@Body()x:{treasuryId:string;postingDate:string;number:string}){
    const ctx=await this.context(this.headers(a,c,b));return this.assets.payLoanInstallment({companyId:ctx.companyId,loanId,installmentId,...x});
  }

  @Post('inventory/contracts')
  async createContract(@Headers('authorization')a:string,@Headers('x-company-id')c:string,@Headers('x-branch-id')b:string,@Body()x:ContractInput){
    const ctx=await this.inventoryContext(this.headers(a,c,b));return this.inventory.createContract({companyId:ctx.companyId,type:x.type,...(x.supplierId?{supplierId:x.supplierId}:{}),effectiveFrom:x.effectiveFrom,effectiveTo:x.effectiveTo,...(x.sourceType&&x.sourceId?{sourceReference:sourceReference(x.sourceType,x.sourceId)}:{})},randomUUID());
  }
  @Get('inventory/contracts/:id')
  async getContract(@Headers('authorization')a:string,@Headers('x-company-id')c:string,@Headers('x-branch-id')b:string,@Param('id')id:string){
    const ctx=await this.inventoryContext(this.headers(a,c,b),false);return {contract:await this.inventory.getContract(ctx.companyId,id),versions:await this.inventory.getContractVersions(ctx.companyId,id)};
  }
  @Post('inventory/contracts/:id/amend')
  async amendContract(@Headers('authorization')a:string,@Headers('x-company-id')c:string,@Headers('x-branch-id')b:string,@Param('id')id:string,@Body()x:{terms:Record<string,unknown>;effectiveFrom:string;effectiveTo?:string}){
    const ctx=await this.inventoryContext(this.headers(a,c,b));return this.inventory.amendContract({companyId:ctx.companyId,contractId:id,terms:x.terms,effectiveFrom:x.effectiveFrom,...(x.effectiveTo?{effectiveTo:x.effectiveTo}:{})},randomUUID());
  }
  @Post('inventory/resources')
  async createResource(@Headers('authorization')a:string,@Headers('x-company-id')c:string,@Headers('x-branch-id')b:string,@Body()x:InventoryResourceInput){
    const ctx=await this.inventoryContext(this.headers(a,c,b)),key=randomUUID();
    if(x.kind==='HOTEL')return this.inventory.createHotelInventory({companyId:ctx.companyId,contractId:x.contractId,hotelId:x.hotelId??'',...(x.roomId?{roomId:x.roomId}:{}),serviceDate:x.serviceDate??'',contractedQuantity:decimalAmount(x.contractedQuantity??'0')},key);
    if(x.kind==='FLIGHT')return this.inventory.createFlightBlock({companyId:ctx.companyId,contractId:x.contractId,flightNumber:x.flightNumber??'',origin:x.origin??'',destination:x.destination??'',departureDate:x.departureDate??'',totalSeats:decimalAmount(x.totalSeats??'0')},key);
    if(x.kind==='TRANSPORT')return this.inventory.createTransportCapacity({companyId:ctx.companyId,contractId:x.contractId,vehicleId:x.vehicleId??'',capacityUnits:decimalAmount(x.capacityUnits??'0'),periodStart:x.periodStart??'',periodEnd:x.periodEnd??''},key);
    if(x.kind==='VISA')return this.inventory.createVisaQuota({companyId:ctx.companyId,contractId:x.contractId,visaType:x.visaType??'',...(x.nationality?{nationality:x.nationality}:{}),quotaTotal:decimalAmount(x.quotaTotal??'0'),effectiveFrom:x.effectiveFrom??'',effectiveTo:x.effectiveTo??''},key);
    return this.inventory.createGenericService({companyId:ctx.companyId,contractId:x.contractId,category:x.category??'OTHER',name:x.name??'',...(x.description?{description:x.description}:{}),unit:x.unit??'',serviceStart:x.serviceStart??'',serviceEnd:x.serviceEnd??'',capacity:decimalAmount(x.capacity??'0'),...(x.releaseDeadline?{releaseDeadline:x.releaseDeadline}:{})},key);
  }
  @Post('inventory/availability')
  async availability(@Headers('authorization')a:string,@Headers('x-company-id')c:string,@Headers('x-branch-id')b:string,@Body()x:AvailabilityInput){
    const ctx=await this.inventoryContext(this.headers(a,c,b),false);return this.inventory.checkAvailability({companyId:ctx.companyId,...x});
  }
  @Post('inventory/allocations')
  async allocate(@Headers('authorization')a:string,@Headers('x-company-id')c:string,@Headers('x-branch-id')b:string,@Body()x:AllocationInput){
    const ctx=await this.inventoryContext(this.headers(a,c,b));return this.inventory.allocateCapacity({companyId:ctx.companyId,contractId:x.contractId,resourceType:x.resourceType,resourceId:x.resourceId,program:sourceReference(x.programSourceType,x.programSourceId),serviceDate:x.serviceDate,...(x.periodEnd?{periodEnd:x.periodEnd}:{}),quantity:decimalAmount(x.quantity)},randomUUID());
  }
  @Get('inventory/allocations/:id')
  async allocation(@Headers('authorization')a:string,@Headers('x-company-id')c:string,@Headers('x-branch-id')b:string,@Param('id')id:string){
    const ctx=await this.inventoryContext(this.headers(a,c,b),false);return this.inventory.getAllocation(ctx.companyId,id);
  }
  @Post('inventory/allocations/:id/release')
  async releaseAllocation(@Headers('authorization')a:string,@Headers('x-company-id')c:string,@Headers('x-branch-id')b:string,@Param('id')id:string,@Body()x:{quantity:string}){
    const ctx=await this.inventoryContext(this.headers(a,c,b));return this.inventory.releaseAllocation({companyId:ctx.companyId,allocationId:id,quantity:decimalAmount(x.quantity)},randomUUID());
  }
}
