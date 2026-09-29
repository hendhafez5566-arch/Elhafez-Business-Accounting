import { Body, Controller, Delete, Get, Headers, Param, Post, UnauthorizedException } from '@nestjs/common';
import { executionContext, type ExecutionContext } from '@elhafez/contracts';
import { EntityFileLinksApplicationService, PlatformCoreApplicationService } from '@elhafez/platform-core';
import { customerId, CustomerManagementApplicationService } from '@elhafez/customer-management';

const ENTITY_TYPE='CUSTOMER';
const REFERENCE_TYPE='PLATFORM_FILE';

@Controller('crm/customers/:customerId/files')
export class CrmCustomerFilesController {
  constructor(private readonly customers:CustomerManagementApplicationService,private readonly files:EntityFileLinksApplicationService,private readonly platform:PlatformCoreApplicationService){}

  @Get()
  async list(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('customerId') rawId:string){
    const context=await this.context(auth,company,branch),id=customerId(rawId);await this.customers.get(context,id);return this.files.list(context.companyId,ENTITY_TYPE,id);
  }

  @Get(':fileId')
  async file(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('customerId') rawId:string,@Param('fileId') fileId:string){
    const context=await this.context(auth,company,branch),id=customerId(rawId);await this.customers.get(context,id);const stored=await this.files.content(context.companyId,ENTITY_TYPE,id,fileId);return{metadata:stored.metadata,contentBase64:Buffer.from(stored.content).toString('base64')};
  }

  @Post()
  async upload(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('customerId') rawId:string,@Body() input:{label?:string;contentType?:string;contentBase64?:string}){
    const context=await this.context(auth,company,branch),id=customerId(rawId);await this.platform.authorize(context.actorId,context.companyId,'crm.customer.manage');await this.customers.requireActiveForIntegration(context,id);
    const content=decodeBase64(input.contentBase64);const link=await this.files.attach({companyId:context.companyId,entityType:ENTITY_TYPE,entityId:id,createdBy:context.actorId,label:input.label,contentType:input.contentType?.trim()||'application/octet-stream',content});
    try{await this.customers.registerReferenceForIntegration(context,id,REFERENCE_TYPE,link.fileId);return link;}catch(error){await this.files.detach(context.companyId,ENTITY_TYPE,id,link.fileId).catch(()=>undefined);throw error;}
  }

  @Delete(':fileId')
  async remove(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('customerId') rawId:string,@Param('fileId') fileId:string){
    const context=await this.context(auth,company,branch),id=customerId(rawId);await this.platform.authorize(context.actorId,context.companyId,'crm.customer.manage');await this.customers.get(context,id);
    await this.customers.releaseReferenceForIntegration(context,id,REFERENCE_TYPE,fileId);
    try{await this.files.detach(context.companyId,ENTITY_TYPE,id,fileId);}catch(error){await this.customers.registerReferenceForIntegration(context,id,REFERENCE_TYPE,fileId).catch(()=>undefined);throw error;}return{deleted:true};
  }

  private async context(auth:string|undefined,company:string|undefined,branch:string|undefined):Promise<ExecutionContext>{if(!auth?.startsWith('Bearer ')||!company||!branch)throw new UnauthorizedException('authenticated company and branch context required');const user=await this.platform.currentUser(auth.slice(7));return executionContext(company,branch,user.id);}
}

function decodeBase64(value:string|undefined):Uint8Array{
  const text=value?.trim();if(!text)throw new Error('contentBase64 is required');
  const bytes=Buffer.from(text,'base64');if(bytes.byteLength===0)throw new Error('file content is empty');
  if(bytes.byteLength>10*1024*1024)throw new Error('file exceeds 10 MB limit');return bytes;
}
