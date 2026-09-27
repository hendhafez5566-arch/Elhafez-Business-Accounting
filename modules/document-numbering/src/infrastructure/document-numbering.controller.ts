import{Body,Controller,Get,Headers,Inject,Param,Patch,Post,Query,UnauthorizedException}from'@nestjs/common';
import{PlatformCoreApplicationService}from'@elhafez/platform-core';
import{DocumentNumberingApplicationService}from'../application/document-numbering.application-service.js';
import type{AllocateDocumentNumberInput,CreateNumberingPolicyInput,DocumentNumberingContext,UpdateNumberingPolicyInput}from'../application/document-numbering.application-service.js';

@Controller('document-numbering')
export class DocumentNumberingController{
 constructor(@Inject(DocumentNumberingApplicationService)private readonly service:DocumentNumberingApplicationService,@Inject(PlatformCoreApplicationService)private readonly platform:PlatformCoreApplicationService){}
 @Get()async list(@Headers('authorization')authorization:string|undefined,@Headers('x-company-id')companyId:string|undefined,@Query('documentType')documentType?:string){return this.service.listPolicies(await this.context(authorization,companyId),documentType);}
 @Post()async create(@Headers('authorization')authorization:string|undefined,@Headers('x-company-id')companyId:string|undefined,@Body()input:CreateNumberingPolicyInput){return this.service.createPolicy(await this.context(authorization,companyId),input);}
 @Patch(':policyId')async update(@Headers('authorization')authorization:string|undefined,@Headers('x-company-id')companyId:string|undefined,@Param('policyId')policyId:string,@Body()input:UpdateNumberingPolicyInput){return this.service.updatePolicy(await this.context(authorization,companyId),policyId,input);}
 @Post('allocate')async allocate(@Headers('authorization')authorization:string|undefined,@Headers('x-company-id')companyId:string|undefined,@Body()input:AllocateDocumentNumberInput){return this.service.allocate(await this.context(authorization,companyId),input);}
 private async context(authorization:string|undefined,companyId:string|undefined):Promise<DocumentNumberingContext>{if(!authorization?.startsWith('Bearer ')||!companyId)throw new UnauthorizedException('authenticated company context required');const user=await this.platform.currentUser(authorization.slice(7));return{companyId,actorId:user.id};}
}
