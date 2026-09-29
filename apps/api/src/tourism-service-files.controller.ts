import { Body, Controller, Delete, Get, Headers, Inject, Param, Post, UnauthorizedException } from '@nestjs/common';
import { executionContext, type ExecutionContext } from '@elhafez/contracts';
import { EntityFileLinksApplicationService, PlatformCoreApplicationService, type EntityFileLink, type StoredFile } from '@elhafez/platform-core';
import { StandaloneServicesApplicationService } from '@elhafez/standalone-services';

const ENTITY_TYPE='TOURISM_SERVICE';
type FileContentResponse={metadata:StoredFile;contentBase64:string};

@Controller('tourism/services/:serviceId/files')
export class TourismServiceFilesController{
  constructor(
    @Inject(StandaloneServicesApplicationService) private readonly services:StandaloneServicesApplicationService,
    @Inject(EntityFileLinksApplicationService) private readonly files:EntityFileLinksApplicationService,
    @Inject(PlatformCoreApplicationService) private readonly platform:PlatformCoreApplicationService,
  ){}

  @Get()
  async list(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('serviceId') id:string):Promise<EntityFileLink[]>{
    const c=await this.context(auth,company,branch,'tourism.services.view');await this.requireService(c,id);return this.files.list(c.companyId,ENTITY_TYPE,id);
  }

  @Get(':fileId')
  async file(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('serviceId') id:string,@Param('fileId') fileId:string):Promise<FileContentResponse>{
    const c=await this.context(auth,company,branch,'tourism.services.view');await this.requireService(c,id);const stored=await this.files.content(c.companyId,ENTITY_TYPE,id,fileId);return{metadata:stored.metadata,contentBase64:Buffer.from(stored.content).toString('base64')};
  }

  @Post()
  async upload(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('serviceId') id:string,@Body() input:{label?:string;contentType?:string;contentBase64?:string}):Promise<EntityFileLink>{
    const c=await this.context(auth,company,branch,'tourism.services.manage');await this.requireService(c,id);return this.files.attach({companyId:c.companyId,entityType:ENTITY_TYPE,entityId:id,createdBy:c.actorId,label:input.label,contentType:input.contentType?.trim()||'application/octet-stream',content:decodeBase64(input.contentBase64)});
  }

  @Delete(':fileId')
  async remove(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('serviceId') id:string,@Param('fileId') fileId:string):Promise<{deleted:true}>{
    const c=await this.context(auth,company,branch,'tourism.services.manage');await this.requireService(c,id);await this.files.detach(c.companyId,ENTITY_TYPE,id,fileId);return{deleted:true};
  }

  private async requireService(c:ExecutionContext,id:string){const result=await this.services.getService(c.companyId,id);if(result.service.branchId!==c.branchId)throw new UnauthorizedException('service outside branch');return result;}
  private async context(auth:string|undefined,company:string|undefined,branch:string|undefined,permission:string):Promise<ExecutionContext>{if(!auth?.startsWith('Bearer ')||!company||!branch)throw new UnauthorizedException('authenticated company and branch context required');const user=await this.platform.currentUser(auth.slice(7));await this.platform.requireBranchAccess(user.id,company,branch);await this.platform.authorize(user.id,company,permission);return executionContext(company,branch,user.id);}
}

function decodeBase64(value:string|undefined):Uint8Array{const text=value?.trim();if(!text)throw new Error('contentBase64 is required');const bytes=Buffer.from(text,'base64');if(bytes.byteLength===0)throw new Error('file content is empty');if(bytes.byteLength>10*1024*1024)throw new Error('file exceeds 10 MB limit');return bytes;}
