import { randomUUID } from 'node:crypto';
import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ContractValidationError, decimalAmount, executionContext, sourceReference, type ExecutionContext } from '@elhafez/contracts';
import { PlatformCoreApplicationService, PlatformError } from '@elhafez/platform-core';
import { StandaloneServicesApplicationService, type CreateServiceDraftInput, type ServiceType, type UpdateServiceDraftInput } from '@elhafez/standalone-services';
import { TOURISM_CONTRACT_INVENTORY_SERVICE } from '@elhafez/tourism-contract-inventory/nest';
import type { PlanStandaloneSupplyInput, TourismContractInventoryApplicationService } from '@elhafez/tourism-contract-inventory';
import { ServiceFulfillmentApplicationService } from '@elhafez/service-fulfillment';
import { ServiceVouchersApplicationService } from '@elhafez/service-vouchers';
import { TourismFinanceOrchestrationApplicationService } from '@elhafez/tourism-finance-orchestration';
import { CustomerManagementApplicationService } from '@elhafez/customer-management';
import { AgentManagementApplicationService } from '@elhafez/agent-management';
import { SupplierManagementApplicationService } from '@elhafez/supplier-management';
import { TravelerManagementApplicationService, travelerId } from '@elhafez/traveler-management';

export const TOURISM_SERVICE_PERMISSIONS = Object.freeze({ view: 'tourism.services.view', manage: 'tourism.services.manage', confirm: 'tourism.services.confirm', cancel: 'tourism.services.cancel', fulfill: 'tourism.services.fulfill', voucher: 'tourism.services.voucher' });
type HeadersContext = { authorization?: string; companyId?: string; branchId?: string };
type DraftLinks = Pick<CreateServiceDraftInput,'customerPartyId'|'debtorKind'|'debtorPartyId'|'beneficiaryPartyIds'|'details'>;
@Controller('tourism/services')
export class TourismServicesController {
  static readonly runtimeDependencies = [StandaloneServicesApplicationService, TOURISM_CONTRACT_INVENTORY_SERVICE, PlatformCoreApplicationService, ServiceFulfillmentApplicationService, ServiceVouchersApplicationService, TourismFinanceOrchestrationApplicationService, CustomerManagementApplicationService, AgentManagementApplicationService, SupplierManagementApplicationService, TravelerManagementApplicationService] as const;
  constructor(private readonly services: StandaloneServicesApplicationService,
    @Inject(TOURISM_CONTRACT_INVENTORY_SERVICE) private readonly inventory: TourismContractInventoryApplicationService,
    private readonly platform: PlatformCoreApplicationService,
    private readonly fulfillment: ServiceFulfillmentApplicationService,
    private readonly vouchers: ServiceVouchersApplicationService,
    private readonly finance: TourismFinanceOrchestrationApplicationService,
    private readonly customers: CustomerManagementApplicationService,
    private readonly agents: AgentManagementApplicationService,
    private readonly suppliers: SupplierManagementApplicationService,
    private readonly travelers: TravelerManagementApplicationService) {}
  private async context(headers: HeadersContext, permission: string): Promise<ExecutionContext> {
    if (!headers.authorization?.startsWith('Bearer ') || !headers.companyId || !headers.branchId) throw new UnauthorizedException('authenticated company and branch context required');
    const user = await this.platform.currentUser(headers.authorization.slice(7));
    const context = executionContext(headers.companyId, headers.branchId, user.id);
    await this.platform.requireBranchAccess(user.id, context.companyId, context.branchId);
    await this.platform.authorize(user.id, context.companyId, permission);
    return context;
  }
  private headers(authorization?: string, companyId?: string, branchId?: string): HeadersContext { return { authorization, companyId, branchId }; }
  private travelerIds(details: Readonly<Record<string, unknown>>): string[] {
    const value=details.travelerIds;
    if(value===undefined)return [];
    if(!Array.isArray(value)||value.some(item=>typeof item!=='string'||!item.trim()))throw new ContractValidationError('details.travelerIds','must be an array of traveler ids');
    return [...new Set(value.map(item=>(item as string).trim()))];
  }
  private async validateDraftLinks(context:ExecutionContext,input:DraftLinks):Promise<void>{
    const customers=await this.customers.list(context,'ACTIVE');
    const customer=customers.find(row=>row.party.id===input.customerPartyId);
    if(!customer)throw new ContractValidationError('customerPartyId','must reference an active customer visible in this company');
    if(input.debtorKind==='CUSTOMER'){
      if(input.debtorPartyId!==customer.party.id)throw new ContractValidationError('debtorPartyId','customer debtor must match the selected customer');
    }else{
      const agents=await this.agents.list(context,'ACTIVE');
      if(!agents.some(row=>row.party.id===input.debtorPartyId))throw new ContractValidationError('debtorPartyId','must reference an active agent visible in this company');
    }
    const travelerIds=this.travelerIds(input.details);
    const travelers=await Promise.all(travelerIds.map(id=>this.travelers.requireActiveForIntegration(context,travelerId(id))));
    const beneficiaryPartyIds=input.beneficiaryPartyIds??[];
    for(const traveler of travelers){
      if(!traveler.partyId)throw new ContractValidationError('details.travelerIds','selected traveler has no canonical party linkage');
      if(!beneficiaryPartyIds.includes(traveler.partyId))throw new ContractValidationError('beneficiaryPartyIds','must contain the canonical party for each selected traveler');
    }
    const uniqueBeneficiaries=[...new Set(beneficiaryPartyIds)];
    if(uniqueBeneficiaries.length!==beneficiaryPartyIds.length)throw new ContractValidationError('beneficiaryPartyIds','duplicate beneficiary parties are not allowed');
  }
  @Get('capabilities')
  async capabilities(@Headers('authorization') auth?:string,@Headers('x-company-id') company?:string,@Headers('x-branch-id') branch?:string){
    const c=await this.context(this.headers(auth,company,branch),TOURISM_SERVICE_PERMISSIONS.view);
    const entries=await Promise.all(Object.entries(TOURISM_SERVICE_PERMISSIONS).map(async([name,permission])=>{
      try{await this.platform.authorize(c.actorId,c.companyId,permission);return [name,true] as const}
      catch(error){if(error instanceof PlatformError&&error.code==='FORBIDDEN')return [name,false] as const;throw error}
    }));
    return Object.fromEntries(entries);
  }
  @Get('types')
  async types(@Headers('authorization') auth?: string, @Headers('x-company-id') company?: string, @Headers('x-branch-id') branch?: string) {
    const c = await this.context(this.headers(auth, company, branch), TOURISM_SERVICE_PERMISSIONS.view);
    return this.services.listTypes(c.companyId);
  }
  @Post('types')
  async saveType(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string,
    @Body() input: Omit<ServiceType, 'companyId'>) {
    const c = await this.context(this.headers(auth, company, branch), TOURISM_SERVICE_PERMISSIONS.manage);
    return this.services.manageServiceType({ ...input, companyId: c.companyId });
  }
  @Get()
  async list(@Headers('authorization') auth?: string, @Headers('x-company-id') company?: string, @Headers('x-branch-id') branch?: string) {
    const c = await this.context(this.headers(auth, company, branch), TOURISM_SERVICE_PERMISSIONS.view);
    return this.services.listServices(c.companyId, c.branchId);
  }
  @Post()
  async create(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string,
    @Body() input: Omit<CreateServiceDraftInput, 'companyId'|'branchId'|'actorId'|'id'|'quantity'|'grossAmount'|'discountAmount'> & { id?: string; quantity: string; grossAmount: string; discountAmount: string }) {
    const c = await this.context(this.headers(auth, company, branch), TOURISM_SERVICE_PERMISSIONS.manage);
    await this.validateDraftLinks(c,input);
    return this.services.createDraft({ ...input, id: input.id ?? randomUUID(), companyId: c.companyId, branchId: c.branchId, actorId: c.actorId,
      quantity: decimalAmount(input.quantity), grossAmount: decimalAmount(input.grossAmount), discountAmount: decimalAmount(input.discountAmount) });
  }
  @Get(':id')
  async get(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string, @Param('id') id: string) {
    const c = await this.context(this.headers(auth, company, branch), TOURISM_SERVICE_PERMISSIONS.view);
    const result = await this.services.getService(c.companyId, id);
    if (result.service.branchId !== c.branchId) throw new UnauthorizedException('service outside branch');
    return result;
  }
  @Patch(':id')
  async update(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string,
    @Param('id') id: string, @Body() input: Omit<UpdateServiceDraftInput, 'companyId'|'branchId'|'actorId'|'serviceId'|'quantity'|'grossAmount'|'discountAmount'> & { quantity: string; grossAmount: string; discountAmount: string }) {
    const c = await this.context(this.headers(auth, company, branch), TOURISM_SERVICE_PERMISSIONS.manage);
    await this.validateDraftLinks(c,input);
    return this.services.updateDraft({ ...input, serviceId: id, companyId: c.companyId, branchId: c.branchId, actorId: c.actorId,
      quantity: decimalAmount(input.quantity), grossAmount: decimalAmount(input.grossAmount), discountAmount: decimalAmount(input.discountAmount) });
  }
  @Post(':id/supply-plan')
  async plan(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string,
    @Param('id') id: string, @Body() input: Pick<PlanStandaloneSupplyInput, 'requests'|'externalQuotes'> & { expectedRevision: number }) {
    const c = await this.context(this.headers(auth, company, branch), TOURISM_SERVICE_PERMISSIONS.confirm);
    const { service, revision } = await this.services.getService(c.companyId, id);
    if (service.branchId !== c.branchId || service.status !== 'DRAFT' || revision.revision !== input.expectedRevision) throw new UnauthorizedException('draft or branch changed');
    await Promise.all((input.externalQuotes??[]).map(quote=>this.suppliers.assertSupplierReferenceUsableForProcurementForIntegration(c.companyId,quote.supplierId)));
    return this.inventory.planStandaloneSupply({ companyId: c.companyId, branchId: c.branchId,
      service: sourceReference('TOURISM_SERVICE', id), serviceRevision: revision.revision,
      requests: input.requests.map(request => ({ ...request, quantity: decimalAmount(request.quantity), unitCost: decimalAmount(request.unitCost) })),
      ...(input.externalQuotes ? { externalQuotes: input.externalQuotes.map(quote => ({ ...quote, unitCost: decimalAmount(quote.unitCost) })) } : {}) });
  }
  @Post(':id/confirm')
  async confirm(@Headers('authorization') auth: string, @Headers('x-company-id') company: string, @Headers('x-branch-id') branch: string,
    @Param('id') id: string, @Body() input: { commandKey: string; expectedRevision: number; planId: string; planVersion: number }) {
    const c = await this.context(this.headers(auth, company, branch), TOURISM_SERVICE_PERMISSIONS.confirm);
    return this.services.confirm({ ...input, companyId: c.companyId, branchId: c.branchId, actorId: c.actorId, serviceId: id });
  }
  @Get(':id/fulfillment')
  async getFulfillment(@Headers('authorization') auth:string,@Headers('x-company-id') company:string,@Headers('x-branch-id') branch:string,@Param('id') id:string){
    const c=await this.context(this.headers(auth,company,branch),TOURISM_SERVICE_PERMISSIONS.view);
    const source=await this.services.getService(c.companyId,id);if(source.service.branchId!==c.branchId)throw new UnauthorizedException('service outside branch');
    return this.fulfillment.get(c.companyId,c.branchId,id);
  }
  @Post(':id/fulfillment/confirm')
  async supplierConfirm(@Headers('authorization') auth:string,@Headers('x-company-id') company:string,@Headers('x-branch-id') branch:string,@Param('id') id:string,
    @Body() input:{commandKey:string;quantity:string;at:string;referenceType:string;reference:string;supplierId?:string;fileId?:string;internalCoverage?:boolean}){
    const c=await this.context(this.headers(auth,company,branch),TOURISM_SERVICE_PERMISSIONS.fulfill);
    if(input.supplierId&&!input.internalCoverage)await this.suppliers.assertSupplierReferenceUsableForProcurementForIntegration(c.companyId,input.supplierId);
    return this.fulfillment.confirm({...input,companyId:c.companyId,branchId:c.branchId,serviceId:id,actorId:c.actorId,quantity:decimalAmount(input.quantity)});
  }
  @Post(':id/fulfillment/deliver')
  async deliver(@Headers('authorization') auth:string,@Headers('x-company-id') company:string,@Headers('x-branch-id') branch:string,@Param('id') id:string,
    @Body() input:{commandKey:string;quantity:string;at:string;unit:string;note:string;fileId?:string}){
    const c=await this.context(this.headers(auth,company,branch),TOURISM_SERVICE_PERMISSIONS.fulfill);
    return this.fulfillment.deliver({...input,companyId:c.companyId,branchId:c.branchId,serviceId:id,actorId:c.actorId,quantity:decimalAmount(input.quantity)});
  }
  @Get(':id/vouchers')
  async listVouchers(@Headers('authorization') auth:string,@Headers('x-company-id') company:string,@Headers('x-branch-id') branch:string,@Param('id') id:string){
    const c=await this.context(this.headers(auth,company,branch),TOURISM_SERVICE_PERMISSIONS.view);
    const source=await this.services.getService(c.companyId,id);if(source.service.branchId!==c.branchId)throw new UnauthorizedException('service outside branch');
    return this.vouchers.list(c.companyId,c.branchId,id);
  }
  @Post(':id/vouchers')
  async issueVoucher(@Headers('authorization') auth:string,@Headers('x-company-id') company:string,@Headers('x-branch-id') branch:string,@Param('id') id:string,@Body() input:{commandKey:string;number:string;instructions:string}){
    const c=await this.context(this.headers(auth,company,branch),TOURISM_SERVICE_PERMISSIONS.voucher);
    return this.vouchers.issue({...input,companyId:c.companyId,branchId:c.branchId,serviceId:id});
  }
  @Post(':id/vouchers/:voucherId/void')
  async voidVoucher(@Headers('authorization') auth:string,@Headers('x-company-id') company:string,@Headers('x-branch-id') branch:string,@Param('id') serviceId:string,@Param('voucherId') id:string,@Body() input:{commandKey:string}){
    const c=await this.context(this.headers(auth,company,branch),TOURISM_SERVICE_PERMISSIONS.voucher);
    const list=await this.vouchers.list(c.companyId,c.branchId,serviceId);if(!list.some(v=>v.id===id))throw new UnauthorizedException('voucher outside service');
    return this.vouchers.void({...input,companyId:c.companyId,branchId:c.branchId,id});
  }
  @Post(':id/vouchers/:voucherId/supersede')
  async supersedeVoucher(@Headers('authorization') auth:string,@Headers('x-company-id') company:string,@Headers('x-branch-id') branch:string,@Param('id') serviceId:string,@Param('voucherId') id:string,@Body() input:{commandKey:string;instructions:string}){
    const c=await this.context(this.headers(auth,company,branch),TOURISM_SERVICE_PERMISSIONS.voucher);
    const list=await this.vouchers.list(c.companyId,c.branchId,serviceId);if(!list.some(v=>v.id===id))throw new UnauthorizedException('voucher outside service');
    return this.vouchers.supersede({...input,companyId:c.companyId,branchId:c.branchId,id});
  }
  @Get(':id/vouchers/:voucherId/print')
  async printVoucher(@Headers('authorization') auth:string,@Headers('x-company-id') company:string,@Headers('x-branch-id') branch:string,@Param('id') serviceId:string,@Param('voucherId') id:string){
    const c=await this.context(this.headers(auth,company,branch),TOURISM_SERVICE_PERMISSIONS.view);
    const list=await this.vouchers.list(c.companyId,c.branchId,serviceId);if(!list.some(v=>v.id===id))throw new UnauthorizedException('voucher outside service');
    return this.vouchers.printable(c.companyId,c.branchId,id);
  }
  @Post(':id/cancel')
  async cancel(@Headers('authorization') auth:string,@Headers('x-company-id') company:string,@Headers('x-branch-id') branch:string,@Param('id') id:string,@Body() input:{commandKey:string;postingDate:string}){
    const c=await this.context(this.headers(auth,company,branch),TOURISM_SERVICE_PERMISSIONS.cancel);
    const current=await this.services.getService(c.companyId,id);
    if(current.service.branchId!==c.branchId)throw new UnauthorizedException('service outside branch');
    const commandKey=current.service.status==='CANCELLATION_REQUESTED'?current.service.pendingCommandKey:`${input.commandKey}:${input.postingDate}`;
    const postingDate=current.service.status==='CANCELLATION_REQUESTED'?current.service.cancellationPostingDate:input.postingDate;
    if(!commandKey||!postingDate)throw new UnauthorizedException('cancellation evidence missing');
    return this.services.requestCancellation({companyId:c.companyId,branchId:c.branchId,actorId:c.actorId,serviceId:id,commandKey,postingDate},async command=>{
      const blockers=[...await this.fulfillment.cancellationBlockers(c.companyId,c.branchId,id),...await this.vouchers.cancellationBlockers(c.companyId,c.branchId,id)];
      if(blockers.length)return {cancelled:false,blockers};
      const result=await this.finance.cancelStandaloneService({companyId:c.companyId,branchId:c.branchId,commandKey:command.commandKey,service:sourceReference('TOURISM_SERVICE',id),postingDate,executionCleared:true});
      return {cancelled:result.cancelled,blockers:result.blockers};
    });
  }
}