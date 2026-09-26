import {randomUUID} from 'node:crypto';
import {Body,Controller,Get,Headers,Inject,Param,Post,UnauthorizedException} from '@nestjs/common';
import {currencyCode,decimalAmount,executionContext,sourceReference,type ExecutionContext} from '@elhafez/contracts';
import {PLATFORM_CORE_PERMISSIONS,PlatformCoreApplicationService} from '@elhafez/platform-core';
import {CurrencyFxApplicationService} from '@elhafez/currency-fx';
import {CostBudgetAccountingApplicationService,costCenterId} from '@elhafez/cost-budget-accounting';
import {PartyAccountingApplicationService} from '@elhafez/party-accounting';
import {ExpenseCommissionRecognitionApplicationService} from '@elhafez/expense-commission-recognition';
import {AssetsFinancingApplicationService} from '@elhafez/assets-financing';
import type {ContractType,ServiceCategory,TourismContractInventoryApplicationService} from '@elhafez/tourism-contract-inventory';
import {TOURISM_CONTRACT_INVENTORY_SERVICE} from '@elhafez/tourism-contract-inventory/nest';

const TOURISM_VIEW='tourism.services.view';
const TOURISM_MANAGE='tourism.services.manage';

type HeaderContext={authorization?:string;companyId?:string;branchId?:string};
type SourceInput={sourceType:string;sourceId:string};
const ref=(value:SourceInput)=>sourceReference(value.sourceType,value.sourceId);
const text=(value:string)=>value.trim();

@Controller('capabilities')
export class CapabilityCoverageController{
 constructor(
  @Inject(PlatformCoreApplicationService) private readonly platform:PlatformCoreApplicationService,
  @Inject(TOURISM_CONTRACT_INVENTORY_SERVICE) private readonly inventory:TourismContractInventoryApplicationService,
  @Inject(CurrencyFxApplicationService) private readonly fx:CurrencyFxApplicationService,
  @Inject(CostBudgetAccountingApplicationService) private readonly cost:CostBudgetAccountingApplicationService,
  @Inject(PartyAccountingApplicationService) private readonly partyAccounting:PartyAccountingApplicationService,
  @Inject(ExpenseCommissionRecognitionApplicationService) private readonly ecr:ExpenseCommissionRecognitionApplicationService,
  @Inject(AssetsFinancingApplicationService) private readonly assets:AssetsFinancingApplicationService,
 ){}

 private headers(authorization?:string,companyId?:string,branchId?:string):HeaderContext{return{authorization,companyId,branchId};}
 private async context(headers:HeaderContext,permission:string):Promise<ExecutionContext>{
  if(!headers.authorization?.startsWith('Bearer ')||!headers.companyId||!headers.branchId)throw new UnauthorizedException('authenticated company and branch context required');
  const user=await this.platform.currentUser(headers.authorization.slice(7));
  const context=executionContext(headers.companyId,headers.branchId,user.id);
  await this.platform.requireBranchAccess(user.id,context.companyId,context.branchId);
  await this.platform.authorize(user.id,context.companyId,permission);
  return context;
 }

 @Get('tourism/contracts/:id')
 async contract(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Param('id')id:string){
  const c=await this.context(this.headers(auth,company,branch),TOURISM_VIEW);
  const [contract,versions]=await Promise.all([this.inventory.getContract(c.companyId,id),this.inventory.getContractVersions(c.companyId,id)]);
  return{contract,versions};
 }

 @Get('tourism/allocations/:id')
 async allocation(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Param('id')id:string){
  const c=await this.context(this.headers(auth,company,branch),TOURISM_VIEW);
  const [allocation,blockers]=await Promise.all([this.inventory.getAllocation(c.companyId,id),this.inventory.getReleaseBlockers(c.companyId,id)]);
  return{allocation,blockers};
 }

 @Post('tourism/contracts')
 async createContract(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Body()input:{type:ContractType;supplierId?:string;effectiveFrom:string;effectiveTo:string;source?:SourceInput;commandKey?:string}){
  const c=await this.context(this.headers(auth,company,branch),TOURISM_MANAGE);
  return this.inventory.createContract({companyId:c.companyId,type:input.type,...(text(input.supplierId??'')?{supplierId:text(input.supplierId!)}:{}),effectiveFrom:input.effectiveFrom,effectiveTo:input.effectiveTo,...(input.source?{sourceReference:ref(input.source)}:{})},input.commandKey??randomUUID());
 }

 @Post('tourism/contracts/:id/amend')
 async amendContract(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Param('id')id:string,@Body()input:{terms:Record<string,unknown>;effectiveFrom:string;effectiveTo?:string;source?:SourceInput;commandKey?:string}){
  const c=await this.context(this.headers(auth,company,branch),TOURISM_MANAGE);
  return this.inventory.amendContract({companyId:c.companyId,contractId:id,terms:input.terms,effectiveFrom:input.effectiveFrom,...(input.effectiveTo?{effectiveTo:input.effectiveTo}:{}),...(input.source?{sourceReference:ref(input.source)}:{})},input.commandKey??randomUUID());
 }

 @Post('tourism/inventory/hotel')
 async createHotel(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Body()input:{contractId:string;hotelId:string;roomId?:string;serviceDate:string;contractedQuantity:string;source?:SourceInput;commandKey?:string}){
  const c=await this.context(this.headers(auth,company,branch),TOURISM_MANAGE);
  return this.inventory.createHotelInventory({companyId:c.companyId,contractId:input.contractId,hotelId:input.hotelId,...(input.roomId?{roomId:input.roomId}:{}),serviceDate:input.serviceDate,contractedQuantity:decimalAmount(input.contractedQuantity),...(input.source?{sourceReference:ref(input.source)}:{})},input.commandKey??randomUUID());
 }

 @Post('tourism/inventory/flight')
 async createFlight(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Body()input:{contractId:string;flightNumber:string;origin:string;destination:string;departureDate:string;totalSeats:string;source?:SourceInput;commandKey?:string}){
  const c=await this.context(this.headers(auth,company,branch),TOURISM_MANAGE);
  return this.inventory.createFlightBlock({companyId:c.companyId,contractId:input.contractId,flightNumber:input.flightNumber,origin:input.origin,destination:input.destination,departureDate:input.departureDate,totalSeats:decimalAmount(input.totalSeats),...(input.source?{sourceReference:ref(input.source)}:{})},input.commandKey??randomUUID());
 }

 @Post('tourism/inventory/transport')
 async createTransport(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Body()input:{contractId:string;vehicleId:string;capacityUnits:string;periodStart:string;periodEnd:string;source?:SourceInput;commandKey?:string}){
  const c=await this.context(this.headers(auth,company,branch),TOURISM_MANAGE);
  return this.inventory.createTransportCapacity({companyId:c.companyId,contractId:input.contractId,vehicleId:input.vehicleId,capacityUnits:decimalAmount(input.capacityUnits),periodStart:input.periodStart,periodEnd:input.periodEnd,...(input.source?{sourceReference:ref(input.source)}:{})},input.commandKey??randomUUID());
 }

 @Post('tourism/inventory/visa')
 async createVisa(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Body()input:{contractId:string;visaType:string;nationality?:string;quotaTotal:string;effectiveFrom:string;effectiveTo:string;source?:SourceInput;commandKey?:string}){
  const c=await this.context(this.headers(auth,company,branch),TOURISM_MANAGE);
  return this.inventory.createVisaQuota({companyId:c.companyId,contractId:input.contractId,visaType:input.visaType,...(input.nationality?{nationality:input.nationality}:{}),quotaTotal:decimalAmount(input.quotaTotal),effectiveFrom:input.effectiveFrom,effectiveTo:input.effectiveTo,...(input.source?{sourceReference:ref(input.source)}:{})},input.commandKey??randomUUID());
 }

 @Post('tourism/inventory/service')
 async createService(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Body()input:{contractId:string;category:ServiceCategory;name:string;description?:string;unit:string;serviceStart:string;serviceEnd:string;capacity:string;releaseDeadline?:string;source?:SourceInput;commandKey?:string}){
  const c=await this.context(this.headers(auth,company,branch),TOURISM_MANAGE);
  return this.inventory.createGenericService({companyId:c.companyId,contractId:input.contractId,category:input.category,name:input.name,...(input.description?{description:input.description}:{}),unit:input.unit,serviceStart:input.serviceStart,serviceEnd:input.serviceEnd,capacity:decimalAmount(input.capacity),...(input.releaseDeadline?{releaseDeadline:input.releaseDeadline}:{}),...(input.source?{sourceReference:ref(input.source)}:{})},input.commandKey??randomUUID());
 }

 @Post('tourism/stop-sales')
 async stopSale(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Body()input:{contractId:string;reason:string;effectiveFrom:string;effectiveTo:string;source?:SourceInput;commandKey?:string}){
  const c=await this.context(this.headers(auth,company,branch),TOURISM_MANAGE);
  return this.inventory.createStopSale({companyId:c.companyId,contractId:input.contractId,reason:input.reason,effectiveFrom:input.effectiveFrom,effectiveTo:input.effectiveTo,...(input.source?{sourceReference:ref(input.source)}:{})},input.commandKey??randomUUID());
 }

 @Post('tourism/availability')
 async availability(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Body()input:{contractId:string;resourceType:ContractType;resourceId:string;serviceDate:string;periodEnd?:string}){
  const c=await this.context(this.headers(auth,company,branch),TOURISM_VIEW);
  return this.inventory.checkAvailability({companyId:c.companyId,contractId:input.contractId,resourceType:input.resourceType,resourceId:input.resourceId,serviceDate:input.serviceDate,...(input.periodEnd?{periodEnd:input.periodEnd}:{})});
 }

 @Post('tourism/allocations')
 async allocate(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Body()input:{contractId:string;resourceType:ContractType;resourceId:string;program:SourceInput;serviceDate:string;periodEnd?:string;quantity:string;flightSegment?:SourceInput;visaBatch?:SourceInput;source?:SourceInput;commandKey?:string}){
  const c=await this.context(this.headers(auth,company,branch),TOURISM_MANAGE);
  return this.inventory.allocateCapacity({companyId:c.companyId,contractId:input.contractId,resourceType:input.resourceType,resourceId:input.resourceId,program:ref(input.program),serviceDate:input.serviceDate,...(input.periodEnd?{periodEnd:input.periodEnd}:{}),quantity:decimalAmount(input.quantity),...(input.flightSegment?{flightSegmentReference:ref(input.flightSegment)}:{}),...(input.visaBatch?{visaBatchReference:ref(input.visaBatch)}:{}),...(input.source?{sourceReference:ref(input.source)}:{})},input.commandKey??randomUUID());
 }

 @Post('tourism/allocations/:id/release')
 async release(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Param('id')id:string,@Body()input:{quantity:string;source?:SourceInput;commandKey?:string}){
  const c=await this.context(this.headers(auth,company,branch),TOURISM_MANAGE);
  return this.inventory.releaseAllocation({companyId:c.companyId,allocationId:id,quantity:decimalAmount(input.quantity),...(input.source?{sourceReference:ref(input.source)}:{})},input.commandKey??randomUUID());
 }

 @Get('accounting/currency/base')
 async baseCurrency(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceRead);
  return this.fx.getBaseCurrency(c.companyId);
 }

 @Post('accounting/currency/configure')
 async configureCurrency(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Body()input:{code:string;precision:number;isBase:boolean;status:'ACTIVE'|'INACTIVE'}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  return this.fx.configure({companyId:c.companyId,code:currencyCode(input.code),precision:Number(input.precision),isBase:Boolean(input.isBase),status:input.status});
 }

 @Post('accounting/currency/rates')
 async publishRate(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Body()input:{id?:string;fromCurrency:string;toCurrency:string;effectiveAt:string;rate:string;source:string}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  return this.fx.publishRate({id:input.id??randomUUID(),companyId:c.companyId,fromCurrency:currencyCode(input.fromCurrency),toCurrency:currencyCode(input.toCurrency),effectiveAt:input.effectiveAt,rate:decimalAmount(input.rate),source:input.source});
 }

 @Post('accounting/currency/resolve')
 async resolveRate(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Body()input:{fromCurrency:string;toCurrency:string;at:string}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceRead);
  return this.fx.resolveRate(c.companyId,currencyCode(input.fromCurrency),currencyCode(input.toCurrency),input.at);
 }

 @Post('accounting/cost-centers')
 async createCostCenter(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Body()input:{id?:string;code:string;name:string;parentId?:string}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  return this.cost.create({id:costCenterId(input.id??randomUUID()),companyId:c.companyId,code:input.code.trim().toUpperCase(),name:input.name.trim(),status:'ACTIVE',...(input.parentId?{parentId:costCenterId(input.parentId)}:{})});
 }

 @Get('accounting/cost-centers/:id')
 async getCostCenter(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Param('id')id:string){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceRead);
  return this.cost.get(c.companyId,costCenterId(id));
 }

 @Post('accounting/cost-centers/:id/deactivate')
 async deactivateCostCenter(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Param('id')id:string){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  return this.cost.deactivate(c.companyId,costCenterId(id));
 }

 @Post('accounting/budgets')
 async createBudget(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Body()input:{id?:string;costCenterId:string;periodStart:string;periodEnd:string;currency:string;amount:string}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  return this.cost.createBudget({id:input.id??randomUUID(),companyId:c.companyId,costCenterId:costCenterId(input.costCenterId),periodStart:input.periodStart,periodEnd:input.periodEnd,currency:input.currency,amount:decimalAmount(input.amount)});
 }

 @Post('accounting/budgets/:id/authorize')
 async authorizeBudget(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Param('id')id:string){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  return this.cost.authorizeBudget(c.companyId,id);
 }

 @Get('accounting/budgets/:id/check')
 async checkBudget(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Param('id')id:string){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceRead);
  return this.cost.checkBudget(c.companyId,id);
 }

 @Post('accounting/party-groups')
 async createPartyGroup(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Body()input:{id?:string;name:string;members:{id?:string;role:'CUSTOMER'|'SUPPLIER'|'AGENT';partyId:string}[]}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  return this.partyAccounting.createGroup({id:input.id??randomUUID(),companyId:c.companyId,name:input.name,members:input.members.map(member=>({id:member.id??randomUUID(),role:member.role,partyId:member.partyId}))});
 }

 @Post('accounting/nettings')
 async proposeNetting(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Body()input:{id?:string;groupId:string;customerInvoiceId:string;supplierInvoiceId:string;amount:string;postingDate:string;number:string;approvalRequestId?:string}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  return this.partyAccounting.proposeNetting({id:input.id??randomUUID(),companyId:c.companyId,branchId:c.branchId,groupId:input.groupId,customerInvoiceId:input.customerInvoiceId,supplierInvoiceId:input.supplierInvoiceId,amount:decimalAmount(input.amount),postingDate:input.postingDate,number:input.number,requesterActorId:c.actorId,...(input.approvalRequestId?{approvalRequestId:input.approvalRequestId}:{})});
 }

 @Post('accounting/nettings/:id/execute')
 async executeNetting(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Param('id')id:string){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  return this.partyAccounting.executeNetting(c.companyId,id);
 }

 @Post('accounting/nettings/:id/reverse')
 async reverseNetting(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Param('id')id:string,@Body()input:{postingDate:string;number:string}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  return this.partyAccounting.reverseNetting(c.companyId,id,input.postingDate,input.number);
 }

 @Post('accounting/expenses')
 async createExpense(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Body()input:{id?:string;form:'DIRECT_PAID'|'SUPPLIER_PAYABLE'|'PREPAID'|'CANCELLATION_PENALTY';sourceType:string;sourceId:string;currency:string;amount:string;baseAmount:string;expenseAccountId?:string;prepaidAccountId?:string;billingInvoiceId?:string;approvalRequestId?:string}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  return this.ecr.createExpense({id:input.id??randomUUID(),companyId:c.companyId,branchId:c.branchId,form:input.form,sourceType:input.sourceType,sourceId:input.sourceId,currency:input.currency,amount:decimalAmount(input.amount),baseAmount:decimalAmount(input.baseAmount),...(input.expenseAccountId?{expenseAccountId:input.expenseAccountId}:{}),...(input.prepaidAccountId?{prepaidAccountId:input.prepaidAccountId}:{}),...(input.billingInvoiceId?{billingInvoiceId:input.billingInvoiceId}:{}),...(input.approvalRequestId?{approvalRequestId:input.approvalRequestId}:{})});
 }

 @Post('accounting/expenses/:id/pay')
 async payExpense(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Param('id')id:string,@Body()input:{treasuryId:string;paymentCurrency:string;postingDate:string;number:string;realizedFxGainAccountId?:string;realizedFxLossAccountId?:string}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  return this.ecr.postPaidExpense({companyId:c.companyId,expenseId:id,actorId:c.actorId,treasuryId:input.treasuryId,paymentCurrency:input.paymentCurrency,postingDate:input.postingDate,number:input.number,...(input.realizedFxGainAccountId?{realizedFxGainAccountId:input.realizedFxGainAccountId}:{}),...(input.realizedFxLossAccountId?{realizedFxLossAccountId:input.realizedFxLossAccountId}:{})});
 }

 @Post('accounting/commissions')
 async createCommission(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Body()input:{id?:string;agentPartyId:string;sourceType:string;sourceId:string;currency:string;amount:string;baseCarryingAmount:string;expenseAccountId:string;liabilityAccountId:string;approvalRequestId?:string}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  return this.ecr.createCommissionClaim({id:input.id??randomUUID(),companyId:c.companyId,branchId:c.branchId,agentPartyId:input.agentPartyId,sourceType:input.sourceType,sourceId:input.sourceId,currency:input.currency,amount:decimalAmount(input.amount),baseCarryingAmount:decimalAmount(input.baseCarryingAmount),expenseAccountId:input.expenseAccountId,liabilityAccountId:input.liabilityAccountId,requesterActorId:c.actorId,...(input.approvalRequestId?{approvalRequestId:input.approvalRequestId}:{})});
 }

 @Post('accounting/commissions/:id/approve')
 async approveCommission(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Param('id')id:string,@Body()input:{postingDate:string;number:string}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  return this.ecr.approveCommission(c.companyId,id,input.postingDate,input.number);
 }

 @Post('accounting/commissions/:id/pay')
 async payCommission(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Param('id')id:string,@Body()input:{paymentId?:string;treasuryId:string;amount:string;paymentCurrency:string;postingDate:string;number:string;realizedFxGainAccountId?:string;realizedFxLossAccountId?:string}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  return this.ecr.payCommission({companyId:c.companyId,claimId:id,paymentId:input.paymentId??randomUUID(),treasuryId:input.treasuryId,amount:decimalAmount(input.amount),paymentCurrency:input.paymentCurrency,postingDate:input.postingDate,number:input.number,...(input.realizedFxGainAccountId?{realizedFxGainAccountId:input.realizedFxGainAccountId}:{}),...(input.realizedFxLossAccountId?{realizedFxLossAccountId:input.realizedFxLossAccountId}:{})});
 }

 @Post('accounting/assets')
 async registerAsset(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Body()input:{id?:string;number:string;code:string;name:string;description?:string;acquisitionValue:string;baseValue:string;currency:string;acquisitionDate:string;capitalizationDate:string;inServiceDate:string;residualValue:string;usefulLifeMonths:number;assetAccountId:string;capitalizationOffsetAccountId:string;accumulatedDepreciationAccountId:string;depreciationExpenseAccountId:string;disposalGainAccountId?:string;disposalLossAccountId?:string}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  return this.assets.registerAsset({id:input.id??randomUUID(),companyId:c.companyId,number:input.number,code:input.code,name:input.name,...(input.description?{description:input.description}:{}),acquisitionValue:decimalAmount(input.acquisitionValue),baseValue:decimalAmount(input.baseValue),currency:input.currency,acquisitionDate:input.acquisitionDate,capitalizationDate:input.capitalizationDate,inServiceDate:input.inServiceDate,residualValue:decimalAmount(input.residualValue),usefulLifeMonths:Number(input.usefulLifeMonths),assetAccountId:input.assetAccountId,capitalizationOffsetAccountId:input.capitalizationOffsetAccountId,accumulatedDepreciationAccountId:input.accumulatedDepreciationAccountId,depreciationExpenseAccountId:input.depreciationExpenseAccountId,...(input.disposalGainAccountId?{disposalGainAccountId:input.disposalGainAccountId}:{}),...(input.disposalLossAccountId?{disposalLossAccountId:input.disposalLossAccountId}:{})});
 }

 @Post('accounting/assets/:id/depreciation')
 async depreciateAsset(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Param('id')assetId:string,@Body()input:{id?:string;period:number;postingDate:string;number:string}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  return this.assets.postDepreciation({id:input.id??randomUUID(),companyId:c.companyId,assetId,period:Number(input.period),postingDate:input.postingDate,number:input.number});
 }

 @Post('accounting/loans')
 async originateLoan(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Body()input:{id?:string;lenderId:string;reference:string;principal:string;currency:string;baseAmount:string;liabilityAccountId:string;interestExpenseAccountId:string;fundingTreasuryId:string;postingDate:string;number:string;installments:{id?:string;dueDate:string;principal:string;interest:string}[]}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  return this.assets.originateLoan({id:input.id??randomUUID(),companyId:c.companyId,lenderId:input.lenderId,reference:input.reference,principal:decimalAmount(input.principal),currency:input.currency,baseAmount:decimalAmount(input.baseAmount),liabilityAccountId:input.liabilityAccountId,interestExpenseAccountId:input.interestExpenseAccountId,fundingTreasuryId:input.fundingTreasuryId,postingDate:input.postingDate,number:input.number,installments:input.installments.map(item=>({id:item.id??randomUUID(),dueDate:item.dueDate,principal:decimalAmount(item.principal),interest:decimalAmount(item.interest)}))});
 }

 @Post('accounting/loans/:loanId/installments/:installmentId/pay')
 async payLoanInstallment(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Param('loanId')loanId:string,@Param('installmentId')installmentId:string,@Body()input:{treasuryId:string;postingDate:string;number:string}){
  const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
  return this.assets.payLoanInstallment({companyId:c.companyId,loanId,installmentId,treasuryId:input.treasuryId,postingDate:input.postingDate,number:input.number});
 }
}
