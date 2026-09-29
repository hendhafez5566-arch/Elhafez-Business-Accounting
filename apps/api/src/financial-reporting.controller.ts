import{BadRequestException,Controller,Get,Headers,Inject,Param,Query,UnauthorizedException}from'@nestjs/common';
import{executionContext,type ExecutionContext}from'@elhafez/contracts';
import{FinancialReportingApplicationService,type ReportScope}from'@elhafez/financial-reporting';
import{PLATFORM_CORE_PERMISSIONS,PlatformCoreApplicationService}from'@elhafez/platform-core';

const ISO_DATE=/^(\d{4})-(\d{2})-(\d{2})$/;
type AgingSide='CUSTOMER'|'SUPPLIER'|'AGENT';
function date(field:string,value:string|undefined){if(!value)return undefined;const match=ISO_DATE.exec(value);if(!match)throw new BadRequestException(`${field} must be YYYY-MM-DD`);const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]),parsed=new Date(Date.UTC(year,month-1,day));if(parsed.getUTCFullYear()!==year||parsed.getUTCMonth()!==month-1||parsed.getUTCDate()!==day)throw new BadRequestException(`${field} is not a valid calendar date`);return value;}

@Controller('accounting/reports')
export class FinancialReportingController{
 constructor(@Inject(FinancialReportingApplicationService)private readonly reporting:FinancialReportingApplicationService,@Inject(PlatformCoreApplicationService)private readonly platform:PlatformCoreApplicationService){}

 @Get('statements')
 async statements(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Query('from')from?:string,@Query('to')to?:string,@Query('asOf')asOf?:string){const c=await this.context(auth,company,branch);const scope=this.scope(c,from,to,asOf);const[trialBalance,incomeStatement,balanceSheet]=await Promise.all([this.reporting.trialBalance(scope),this.reporting.incomeStatement(scope),this.reporting.balanceSheet(scope)]);return{trialBalance,incomeStatement,balanceSheet};}

 @Get('aging')
 async aging(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Query('side')side:string|undefined,@Query('from')from?:string,@Query('to')to?:string,@Query('asOf')asOf?:string){const c=await this.context(auth,company,branch);if(side!=='CUSTOMER'&&side!=='SUPPLIER'&&side!=='AGENT')throw new BadRequestException('side must be CUSTOMER, SUPPLIER or AGENT');return this.reporting.aging(this.scope(c,from,to,asOf),side as AgingSide);}

 @Get('treasury')
 async treasury(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Query('from')from?:string,@Query('to')to?:string,@Query('asOf')asOf?:string){const c=await this.context(auth,company,branch);return this.reporting.treasury(this.scope(c,from,to,asOf));}

 @Get('tax')
 async tax(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Query('from')from?:string,@Query('to')to?:string,@Query('asOf')asOf?:string){const c=await this.context(auth,company,branch);return this.reporting.tax(this.scope(c,from,to,asOf));}

 @Get('program/:id')
 async program(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Param('id')id:string,@Query('from')from?:string,@Query('to')to?:string,@Query('asOf')asOf?:string){const c=await this.context(auth,company,branch);if(!id.trim())throw new BadRequestException('program id is required');return this.reporting.getProgramAccountingSnapshot(this.scope(c,from,to,asOf),id);}

 @Get('supplier')
 async supplier(@Headers('authorization')auth:string|undefined,@Headers('x-company-id')company:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Query('from')from?:string,@Query('to')to?:string,@Query('asOf')asOf?:string){const c=await this.context(auth,company,branch);return this.reporting.supplier(this.scope(c,from,to,asOf));}

 private scope(c:ExecutionContext,from?:string,to?:string,asOf?:string):ReportScope{const start=date('from',from),end=date('to',to),at=date('asOf',asOf);if(start&&end&&start>end)throw new BadRequestException('from must not be after to');return{companyId:c.companyId,branchIds:[c.branchId],...(start?{from:start}:{}),...(end?{to:end}:{}),...(at?{asOf:at}:{})};}
 private async context(auth:string|undefined,company:string|undefined,branch:string|undefined):Promise<ExecutionContext>{if(!auth?.startsWith('Bearer ')||!company||!branch)throw new UnauthorizedException('authenticated company and branch context required');const user=await this.platform.currentUser(auth.slice(7));const c=executionContext(company,branch,user.id);await this.platform.requireBranchAccess(c.actorId,c.companyId,c.branchId);await this.platform.authorize(c.actorId,c.companyId,PLATFORM_CORE_PERMISSIONS.accountingFinanceRead);return c;}
}
