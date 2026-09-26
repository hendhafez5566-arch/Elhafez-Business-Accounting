import { randomUUID } from 'node:crypto';
import { Body, Controller, Get, Headers, Param, Post, UnauthorizedException } from '@nestjs/common';
import { currencyCode, decimalAmount, executionContext, type ExecutionContext } from '@elhafez/contracts';
import { CurrencyFxApplicationService } from '@elhafez/currency-fx';
import { CostBudgetAccountingApplicationService, costCenterId } from '@elhafez/cost-budget-accounting';
import { PartyAccountingApplicationService } from '@elhafez/party-accounting';
import { ExpenseCommissionRecognitionApplicationService, type ExpenseForm } from '@elhafez/expense-commission-recognition';
import { AssetsFinancingApplicationService } from '@elhafez/assets-financing';
import { PLATFORM_CORE_PERMISSIONS, PlatformCoreApplicationService, PlatformError } from '@elhafez/platform-core';

type HeaderContext={authorization?:string;companyId?:string;branchId?:string};
type GroupMemberInput={role:'CUSTOMER'|'SUPPLIER'|'AGENT';partyId:string};
type LoanInstallmentInput={dueDate:string;principal:string;interest:string};

@Controller('accounting/advanced')
export class AdvancedAccountingController {
  constructor(
    private readonly platform:PlatformCoreApplicationService,
    private readonly fx:CurrencyFxApplicationService,
    private readonly cost:CostBudgetAccountingApplicationService,
    private readonly parties:PartyAccountingApplicationService,
    private readonly ecr:ExpenseCommissionRecognitionApplicationService,
    private readonly assets:AssetsFinancingApplicationService,
  ) {}

  private headers(authorization?:string,companyId?:string,branchId?:string):HeaderContext{return{authorization,companyId,branchId};}
  private async context(headers:HeaderContext,permission:string):Promise<ExecutionContext>{
    if(!headers.authorization?.startsWith('Bearer ')||!headers.companyId||!headers.branchId)throw new UnauthorizedException('authenticated company and branch context required');
    const user=await this.platform.currentUser(headers.authorization.slice(7));
    const context=executionContext(headers.companyId,headers.branchId,user.id);
    await this.platform.requireBranchAccess(user.id,context.companyId,context.branchId);
    await this.platform.authorize(user.id,context.companyId,permission);
    return context;
  }

  @Get('capabilities')
  async capabilities(@Headers('authorization')auth?:string,@Headers('x-company-id')company?:string,@Headers('x-branch-id')branch?:string){
    const context=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceRead);
    try{await this.platform.authorize(context.actorId,context.companyId,PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);return{read:true,operate:true};}
    catch(error){if(error instanceof PlatformError&&error.code==='FORBIDDEN')return{read:true,operate:false};throw error;}
  }

  @Get('overview')
  async overview(@Headers('authorization')auth?:string,@Headers('x-company-id')company?:string,@Headers('x-branch-id')branch?:string){
    const context=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceRead);
    const[currencies,rates,costCenters,budgets,partyGroups,nettings,expenses,recognitionSchedules,commissionClaims,accruals,assets,loans,provisions,allowances,payrollRuns]=await Promise.all([
      this.fx.listCurrencies(context.companyId),this.fx.listRates(context.companyId),
      this.cost.listCostCenters(context.companyId),this.cost.listBudgets(context.companyId),
      this.parties.listGroups(context.companyId),this.parties.listNettings(context.companyId,context.branchId),
      this.ecr.listExpenses(context.companyId,context.branchId),this.ecr.listRecognitionSchedules(context.companyId),
      this.ecr.listCommissionClaims(context.companyId,context.branchId),this.ecr.listAccruals(context.companyId),
      this.assets.listAssets(context.companyId),this.assets.listLoans(context.companyId),this.assets.listProvisions(context.companyId),
      this.assets.listAllowances(context.companyId),this.assets.listPayrollRuns(context.companyId),
    ]);
    return{currencies,rates,costCenters,budgets,partyGroups,nettings,expenses,recognitionSchedules,commissionClaims,accruals,assets,loans,provisions,allowances,payrollRuns};
  }

  @Post('currencies')
  async configureCurrency(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()body:{code:string;precision:number;isBase:boolean;status:'ACTIVE'|'INACTIVE'}){
    const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
    return this.fx.configure({companyId:c.companyId,code:currencyCode(body.code),precision:body.precision,isBase:body.isBase,status:body.status});
  }

  @Post('fx-rates')
  async publishRate(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()body:{fromCurrency:string;toCurrency:string;effectiveAt:string;rate:string;source:string}){
    const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
    return this.fx.publishRate({id:randomUUID(),companyId:c.companyId,fromCurrency:currencyCode(body.fromCurrency),toCurrency:currencyCode(body.toCurrency),effectiveAt:body.effectiveAt,rate:decimalAmount(body.rate),source:body.source});
  }

  @Post('cost-centers')
  async createCostCenter(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()body:{code:string;name:string;parentId?:string}){
    const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
    return this.cost.create({id:costCenterId(randomUUID()),companyId:c.companyId,code:body.code.trim().toUpperCase(),name:body.name.trim(),status:'ACTIVE',...(body.parentId?.trim()?{parentId:costCenterId(body.parentId.trim())}:{})});
  }

  @Post('cost-centers/:id/deactivate')
  async deactivateCostCenter(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Param('id')id:string){
    const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
    return this.cost.deactivate(c.companyId,costCenterId(id));
  }

  @Post('budgets')
  async createBudget(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()body:{costCenterId:string;periodStart:string;periodEnd:string;currency:string;amount:string}){
    const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
    return this.cost.createBudget({id:randomUUID(),companyId:c.companyId,costCenterId:costCenterId(body.costCenterId),periodStart:body.periodStart,periodEnd:body.periodEnd,currency:body.currency.trim().toUpperCase(),amount:decimalAmount(body.amount)});
  }

  @Post('budgets/:id/authorize')
  async authorizeBudget(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Param('id')id:string){
    const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
    return this.cost.authorizeBudget(c.companyId,id);
  }

  @Post('party-groups')
  async createPartyGroup(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()body:{name:string;members:GroupMemberInput[]}){
    const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
    const groupId=randomUUID();
    return this.parties.createGroup({id:groupId,companyId:c.companyId,name:body.name,members:body.members.map(member=>({id:randomUUID(),role:member.role,partyId:member.partyId}))});
  }

  @Post('nettings')
  async proposeNetting(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()body:{groupId:string;customerInvoiceId:string;supplierInvoiceId:string;amount:string;postingDate:string;number:string;approvalRequestId?:string}){
    const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
    return this.parties.proposeNetting({id:randomUUID(),companyId:c.companyId,branchId:c.branchId,groupId:body.groupId,customerInvoiceId:body.customerInvoiceId,supplierInvoiceId:body.supplierInvoiceId,amount:decimalAmount(body.amount),postingDate:body.postingDate,number:body.number,requesterActorId:c.actorId,...(body.approvalRequestId?.trim()?{approvalRequestId:body.approvalRequestId.trim()}:{})});
  }

  @Post('nettings/:id/execute')
  async executeNetting(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Param('id')id:string){
    const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
    return this.parties.executeNetting(c.companyId,id);
  }

  @Post('expenses')
  async createExpense(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()body:{form:ExpenseForm;sourceType:string;sourceId:string;currency:string;amount:string;baseAmount:string;expenseAccountId?:string;prepaidAccountId?:string;billingInvoiceId?:string;approvalRequestId?:string}){
    const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
    return this.ecr.createExpense({id:randomUUID(),companyId:c.companyId,branchId:c.branchId,form:body.form,sourceType:body.sourceType,sourceId:body.sourceId,currency:body.currency,amount:decimalAmount(body.amount),baseAmount:decimalAmount(body.baseAmount),...(body.expenseAccountId?.trim()?{expenseAccountId:body.expenseAccountId.trim()}:{}),...(body.prepaidAccountId?.trim()?{prepaidAccountId:body.prepaidAccountId.trim()}:{}),...(body.billingInvoiceId?.trim()?{billingInvoiceId:body.billingInvoiceId.trim()}:{}),...(body.approvalRequestId?.trim()?{approvalRequestId:body.approvalRequestId.trim()}:{})});
  }

  @Post('expenses/:id/post')
  async postExpense(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Param('id')id:string,@Body()body:{treasuryId:string;paymentCurrency:string;postingDate:string;number:string;realizedFxGainAccountId?:string;realizedFxLossAccountId?:string}){
    const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
    return this.ecr.postPaidExpense({companyId:c.companyId,expenseId:id,actorId:c.actorId,treasuryId:body.treasuryId,paymentCurrency:body.paymentCurrency,postingDate:body.postingDate,number:body.number,...(body.realizedFxGainAccountId?.trim()?{realizedFxGainAccountId:body.realizedFxGainAccountId.trim()}:{}),...(body.realizedFxLossAccountId?.trim()?{realizedFxLossAccountId:body.realizedFxLossAccountId.trim()}:{})});
  }

  @Post('commissions')
  async createCommission(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()body:{agentPartyId:string;sourceType:string;sourceId:string;currency:string;amount:string;baseCarryingAmount:string;expenseAccountId:string;liabilityAccountId:string;approvalRequestId?:string}){
    const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
    return this.ecr.createCommissionClaim({id:randomUUID(),companyId:c.companyId,branchId:c.branchId,agentPartyId:body.agentPartyId,sourceType:body.sourceType,sourceId:body.sourceId,currency:body.currency,amount:decimalAmount(body.amount),baseCarryingAmount:decimalAmount(body.baseCarryingAmount),expenseAccountId:body.expenseAccountId,liabilityAccountId:body.liabilityAccountId,requesterActorId:c.actorId,...(body.approvalRequestId?.trim()?{approvalRequestId:body.approvalRequestId.trim()}:{})});
  }

  @Post('commissions/:id/approve')
  async approveCommission(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Param('id')id:string,@Body()body:{postingDate:string;number:string}){
    const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
    return this.ecr.approveCommission(c.companyId,id,body.postingDate,body.number);
  }

  @Post('assets')
  async registerAsset(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()body:{code:string;name:string;description?:string;acquisitionValue:string;baseValue:string;currency:string;acquisitionDate:string;capitalizationDate:string;inServiceDate:string;residualValue:string;usefulLifeMonths:number;assetAccountId:string;capitalizationOffsetAccountId:string;accumulatedDepreciationAccountId:string;depreciationExpenseAccountId:string;disposalGainAccountId?:string;disposalLossAccountId?:string;number:string}){
    const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
    return this.assets.registerAsset({id:randomUUID(),companyId:c.companyId,code:body.code,name:body.name,...(body.description?.trim()?{description:body.description.trim()}:{}),acquisitionValue:decimalAmount(body.acquisitionValue),baseValue:decimalAmount(body.baseValue),currency:body.currency,acquisitionDate:body.acquisitionDate,capitalizationDate:body.capitalizationDate,inServiceDate:body.inServiceDate,residualValue:decimalAmount(body.residualValue),usefulLifeMonths:body.usefulLifeMonths,assetAccountId:body.assetAccountId,capitalizationOffsetAccountId:body.capitalizationOffsetAccountId,accumulatedDepreciationAccountId:body.accumulatedDepreciationAccountId,depreciationExpenseAccountId:body.depreciationExpenseAccountId,...(body.disposalGainAccountId?.trim()?{disposalGainAccountId:body.disposalGainAccountId.trim()}:{}),...(body.disposalLossAccountId?.trim()?{disposalLossAccountId:body.disposalLossAccountId.trim()}:{}),number:body.number});
  }

  @Post('assets/:id/depreciation')
  async postDepreciation(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Param('id')id:string,@Body()body:{period:number;postingDate:string;number:string}){
    const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
    return this.assets.postDepreciation({id:randomUUID(),companyId:c.companyId,assetId:id,period:body.period,postingDate:body.postingDate,number:body.number});
  }

  @Post('loans')
  async originateLoan(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()body:{lenderId:string;reference:string;principal:string;currency:string;baseAmount:string;liabilityAccountId:string;interestExpenseAccountId:string;fundingTreasuryId:string;postingDate:string;number:string;installments:LoanInstallmentInput[]}){
    const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
    const loanId=randomUUID();
    return this.assets.originateLoan({id:loanId,companyId:c.companyId,lenderId:body.lenderId,reference:body.reference,principal:decimalAmount(body.principal),currency:body.currency,baseAmount:decimalAmount(body.baseAmount),liabilityAccountId:body.liabilityAccountId,interestExpenseAccountId:body.interestExpenseAccountId,fundingTreasuryId:body.fundingTreasuryId,postingDate:body.postingDate,number:body.number,installments:body.installments.map(item=>({id:randomUUID(),dueDate:item.dueDate,principal:decimalAmount(item.principal),interest:decimalAmount(item.interest)}))});
  }

  @Post('provisions')
  async createProvision(@Headers('authorization')auth:string,@Headers('x-company-id')company:string,@Headers('x-branch-id')branch:string,@Body()body:{name:string;provisionAccountId:string;expenseAccountId:string;releaseAccountId:string}){
    const c=await this.context(this.headers(auth,company,branch),PLATFORM_CORE_PERMISSIONS.accountingFinanceOperate);
    return this.assets.createProvision({id:randomUUID(),companyId:c.companyId,name:body.name,provisionAccountId:body.provisionAccountId,expenseAccountId:body.expenseAccountId,releaseAccountId:body.releaseAccountId});
  }
}
