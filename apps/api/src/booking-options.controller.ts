import {TourismContractInventoryReadApplicationService} from '@elhafez/tourism-contract-inventory';
import {CostBudgetAccountingApplicationService} from '@elhafez/cost-budget-accounting';
import {CurrencyFxApplicationService} from '@elhafez/currency-fx';
import {BOOKING_PERMISSIONS} from '@elhafez/hajj-umrah-bookings';
import {Controller,Get,Headers,UnauthorizedException} from '@nestjs/common';
import {executionContext} from '@elhafez/contracts';
import {PlatformCoreApplicationService} from '@elhafez/platform-core';
import {HajjUmrahProgramsApplicationService} from '@elhafez/hajj-umrah-programs';
import {CustomerManagementApplicationService} from '@elhafez/customer-management';
import {AgentManagementApplicationService} from '@elhafez/agent-management';
import {TravelerManagementApplicationService} from '@elhafez/traveler-management';
@Controller('hajj-umrah/operations/booking-options')
export class BookingOptionsController {
 static readonly runtimeDependencies=[PlatformCoreApplicationService,HajjUmrahProgramsApplicationService,CustomerManagementApplicationService,AgentManagementApplicationService,TravelerManagementApplicationService] as const;
 constructor(private readonly platform:PlatformCoreApplicationService,private readonly programs:HajjUmrahProgramsApplicationService,private readonly customers:CustomerManagementApplicationService,private readonly agents:AgentManagementApplicationService,private readonly travelers:TravelerManagementApplicationService){}
 @Get()
 async options(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined){
  if(!auth?.startsWith('Bearer ')||!companyId||!branchId)throw new UnauthorizedException('authenticated branch required');
  const user=await this.platform.currentCompanyUser(auth.slice(7),companyId),c=executionContext(companyId,branchId,user.id);
  const [programs,customers,agents,travelers]=await Promise.all([this.programs.list(c),this.customers.list(c,'ACTIVE'),this.agents.list(c,'ACTIVE'),this.travelers.list(c,{status:'ACTIVE'})]);
  return {programs:programs.map(x=>({id:x.id,label:x.code+' — '+x.arabicName})),customers:customers.map(x=>({id:x.customer.id,label:x.party.displayName+' — '+x.customer.number})),agents:agents.map(x=>({id:x.agent.id,label:x.party.displayName+' — '+x.agent.number})),travelers:travelers.map(x=>({id:x.id,label:x.fullName}))};
 }
}

@Controller('hajj-umrah/operations/booking-confirmation-options')
export class BookingConfirmationOptionsController {
 static readonly runtimeDependencies=[PlatformCoreApplicationService,TourismContractInventoryReadApplicationService,CostBudgetAccountingApplicationService,CurrencyFxApplicationService] as const;
 constructor(private readonly platform:PlatformCoreApplicationService,private readonly inventory:TourismContractInventoryReadApplicationService,private readonly cost:CostBudgetAccountingApplicationService,private readonly fx:CurrencyFxApplicationService){}
 @Get()
 async options(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined){
  if(!auth?.startsWith('Bearer ')||!companyId||!branchId)throw new UnauthorizedException('authenticated branch required');const user=await this.platform.currentCompanyUser(auth.slice(7),companyId),c=executionContext(companyId,branchId,user.id);await this.platform.requireBranchAccess(c.actorId,c.companyId,c.branchId);await this.platform.authorize(c.actorId,c.companyId,BOOKING_PERMISSIONS.confirm);
  const [contracts,centers,currencies]=await Promise.all([this.inventory.listAvailable(c.companyId),this.cost.list(c.companyId,true),this.fx.listCurrencies(c.companyId)]);
  return{resources:contracts.flatMap(x=>x.resources.filter(r=>r.status==='ACTIVE').map(r=>({id:r.id,contractId:r.contractId,resourceType:r.resourceType,label:r.label+' — '+r.serviceDate+' — المتاح '+r.availableQuantity,serviceDate:r.serviceDate,...(r.periodEnd?{periodEnd:r.periodEnd}:{})}))),costCenters:centers.map(x=>({id:x.id,label:x.code+' — '+x.name})),currencies:currencies.map(x=>String(x.code))};
 }
}
