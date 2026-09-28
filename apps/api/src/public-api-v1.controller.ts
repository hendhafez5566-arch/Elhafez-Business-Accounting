import{Controller,Get,Headers,Inject,Param,Query,UnauthorizedException}from'@nestjs/common';
import{executionContext,type ExecutionContext}from'@elhafez/contracts';
import{IntegrationHubApplicationService}from'@elhafez/integration-hub';
import{CustomerManagementApplicationService,customerId}from'@elhafez/customer-management';
import{QuotationsApplicationService}from'@elhafez/quotations';
import{TourismBookingsApplicationService}from'@elhafez/tourism-bookings';
import{HajjUmrahBookingsApplicationService}from'@elhafez/hajj-umrah-bookings';

@Controller('public-api/v1')
export class PublicApiV1Controller{
 constructor(
  @Inject(IntegrationHubApplicationService)private readonly integrations:IntegrationHubApplicationService,
  @Inject(CustomerManagementApplicationService)private readonly customers:CustomerManagementApplicationService,
  @Inject(QuotationsApplicationService)private readonly quotations:QuotationsApplicationService,
  @Inject(TourismBookingsApplicationService)private readonly tourismBookings:TourismBookingsApplicationService,
  @Inject(HajjUmrahBookingsApplicationService)private readonly umrahBookings:HajjUmrahBookingsApplicationService,
 ){}
 @Get('customers')
 async customersList(@Headers('x-api-key')key?:string,@Headers('x-branch-id')branch?:string,@Query('q')q?:string){const c=await this.ctx(key,branch,'customers.read');return this.customers.list(c,undefined,q)}
 @Get('customers/:id')
 async customer(@Headers('x-api-key')key:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Param('id')id:string){const c=await this.ctx(key,branch,'customers.read');return this.customers.get(c,customerId(id))}
 @Get('quotations')
 async quotationList(@Headers('x-api-key')key?:string,@Headers('x-branch-id')branch?:string,@Query('q')q?:string){const c=await this.ctx(key,branch,'quotations.read');return this.quotations.list(c,q)}
 @Get('quotations/:id')
 async quotation(@Headers('x-api-key')key:string|undefined,@Headers('x-branch-id')branch:string|undefined,@Param('id')id:string){const c=await this.ctx(key,branch,'quotations.read');return this.quotations.get(c,id)}
 @Get('tourism/bookings')
 async tourism(@Headers('x-api-key')key?:string,@Headers('x-branch-id')branch?:string){const c=await this.ctx(key,branch,'tourism.bookings.read');return this.tourismBookings.list(c)}
 @Get('hajj-umrah/bookings')
 async umrah(@Headers('x-api-key')key?:string,@Headers('x-branch-id')branch?:string){const c=await this.ctx(key,branch,'hajj-umrah.bookings.read');return this.umrahBookings.list(c)}
 private async ctx(key:string|undefined,branch:string|undefined,scope:string):Promise<ExecutionContext>{if(!key?.trim()||!branch?.trim())throw new UnauthorizedException('API key and branch are required');const auth=await this.integrations.authenticateApiKey(key,scope);return executionContext(auth.companyId,branch,auth.actorUserId)}
}
