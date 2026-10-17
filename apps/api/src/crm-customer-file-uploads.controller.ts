import {Body,Controller,Get,Headers,Param,Post,Put,UnauthorizedException} from '@nestjs/common';
import {ContractValidationError,executionContext} from '@elhafez/contracts';
import {customerId,CustomerManagementApplicationService} from '@elhafez/customer-management';
import {EntityFileLinksApplicationService,FileUploadApplicationService,PlatformCoreApplicationService,type EntityFileLink} from '@elhafez/platform-core';
@Controller('crm/customers/:customerId/file-uploads')
export class CrmCustomerFileUploadsController {
 static readonly runtimeDependencies=[PlatformCoreApplicationService,CustomerManagementApplicationService,FileUploadApplicationService,EntityFileLinksApplicationService] as const;
 constructor(private readonly platform:PlatformCoreApplicationService,private readonly customers:CustomerManagementApplicationService,private readonly uploads:FileUploadApplicationService,private readonly links:EntityFileLinksApplicationService){}
 private async context(auth:string|undefined,company:string|undefined,branch:string|undefined,rawId:string){if(!auth?.startsWith('Bearer ')||!company||!branch)throw new UnauthorizedException('authenticated branch required');const actor=await this.platform.currentCompanyUser(auth.slice(7),company),c=executionContext(company,branch,actor.id);await this.platform.requireBranchAccess(c.actorId,c.companyId,c.branchId);await this.platform.authorize(c.actorId,c.companyId,'crm.customer.manage');await this.customers.requireActiveForIntegration(c,customerId(rawId));return c;}
 @Post()
 async begin(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('customerId') id:string,@Body() input:{requestId:string;label?:string;contentType:string;size:number;checksum:string}){const c=await this.context(auth,company,branch,id);if(!input||typeof input!=='object'||Array.isArray(input))throw new ContractValidationError('upload','upload metadata is required');return this.uploads.begin(c,{requestId:input.requestId,entityType:'CUSTOMER',entityId:id,label:input.label,contentType:input.contentType,size:input.size,checksum:input.checksum});}
 @Get(':uploadId')
 async status(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('customerId') id:string,@Param('uploadId') uploadId:string){return this.uploads.get(await this.context(auth,company,branch,id),uploadId,'CUSTOMER',id);}
 @Put(':uploadId/chunks/:index')
 async chunk(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('customerId') id:string,@Param('uploadId') uploadId:string,@Param('index') index:string,@Body() input:{contentBase64?:string}){
  const c=await this.context(auth,company,branch,id),text=input?.contentBase64;if(!/^(0|[1-9]\d{0,2})$/.test(index)||typeof text!=='string'||!text.length||text.length>90000||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text))throw new ContractValidationError('chunk','valid bounded base64 chunk required');return this.uploads.chunk(c,uploadId,'CUSTOMER',id,Number(index),Buffer.from(text,'base64'));
 }
 @Post(':uploadId/complete')
 async complete(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('customerId') id:string,@Param('uploadId') uploadId:string):Promise<EntityFileLink>{
  const c=await this.context(auth,company,branch,id),status=await this.uploads.get(c,uploadId,'CUSTOMER',id),file=await this.uploads.complete(c,uploadId,'CUSTOMER',id),link=await this.links.attachExistingOnce({companyId:c.companyId,createdBy:c.actorId,entityType:'CUSTOMER',entityId:id,fileId:file.id,label:status.label??undefined});
  await this.customers.registerReferenceForIntegration(c,customerId(id),'PLATFORM_FILE',file.id);await this.platform.recordAuditOnce('file-upload:'+uploadId,{actorId:c.actorId,companyId:c.companyId,branchId:c.branchId,action:'file.upload.completed',resource:'customer-file',entityId:link.id,metadata:{uploadId,fileId:file.id,checksum:file.checksum,size:file.size}});return link;
 }
}
