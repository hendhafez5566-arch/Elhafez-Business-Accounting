import{Controller,Get,Headers,UnauthorizedException}from'@nestjs/common';import{executionContext}from'@elhafez/contracts';import{PlatformCoreApplicationService}from'@elhafez/platform-core';import{TourismContractInventoryReadApplicationService}from'@elhafez/tourism-contract-inventory';
@Controller('tourism/contracts-inventory')
export class TourismContractInventoryReadController{
 constructor(private readonly platform:PlatformCoreApplicationService,private readonly read:TourismContractInventoryReadApplicationService){}
 @Get('catalog')async catalog(@Headers('authorization')auth?:string,@Headers('x-company-id')companyId?:string,@Headers('x-branch-id')branchId?:string){if(!auth?.startsWith('Bearer ')||!companyId||!branchId)throw new UnauthorizedException('authenticated company and branch context required');const user=await this.platform.currentUser(auth.slice(7));await this.platform.requireBranchAccess(user.id,companyId,branchId);const context=executionContext(companyId,branchId,user.id);return this.read.listAvailable(context.companyId)}
}
