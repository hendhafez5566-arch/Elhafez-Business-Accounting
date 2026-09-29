import { Body, Controller, Delete, Get, Headers, Inject, NotFoundException, Param, Post, UnauthorizedException } from '@nestjs/common';
import { executionContext, type ExecutionContext } from '@elhafez/contracts';
import { EntityFileLinksApplicationService, PlatformCoreApplicationService, type EntityFileLink, type StoredFile } from '@elhafez/platform-core';
import type { TourismContractInventoryApplicationService } from '@elhafez/tourism-contract-inventory';
import { TOURISM_CONTRACT_INVENTORY_SERVICE } from '@elhafez/tourism-contract-inventory/nest';

const ENTITY_TYPE='TOURISM_CONTRACT';
const READ_PERMISSIONS=['tourism.services.view','tourism.programs.view','hajj_umrah.programs.view'] as const;
const MANAGE_PERMISSIONS=['tourism.services.manage','tourism.programs.manage','hajj_umrah.programs.edit'] as const;
type FileContentResponse={metadata:StoredFile;contentBase64:string};

@Controller('tourism/contracts-inventory/contracts/:contractId/files')
export class TourismContractFilesController{
  constructor(
    @Inject(TOURISM_CONTRACT_INVENTORY_SERVICE) private readonly contracts:TourismContractInventoryApplicationService,
    @Inject(EntityFileLinksApplicationService) private readonly files:EntityFileLinksApplicationService,
    @Inject(PlatformCoreApplicationService) private readonly platform:PlatformCoreApplicationService,
  ){}

  @Get()
  async list(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('contractId') contractId:string):Promise<EntityFileLink[]>{
    const context=await this.context(auth,company,branch);await this.authorizeAny(context,READ_PERMISSIONS);await this.requireContract(context,contractId);return this.files.list(context.companyId,ENTITY_TYPE,contractId);
  }

  @Get(':fileId')
  async file(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('contractId') contractId:string,@Param('fileId') fileId:string):Promise<FileContentResponse>{
    const context=await this.context(auth,company,branch);await this.authorizeAny(context,READ_PERMISSIONS);await this.requireContract(context,contractId);const stored=await this.files.content(context.companyId,ENTITY_TYPE,contractId,fileId);return{metadata:stored.metadata,contentBase64:Buffer.from(stored.content).toString('base64')};
  }

  @Post()
  async upload(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('contractId') contractId:string,@Body() input:{label?:string;contentType?:string;contentBase64?:string}):Promise<EntityFileLink>{
    const context=await this.context(auth,company,branch);await this.authorizeAny(context,MANAGE_PERMISSIONS);await this.requireContract(context,contractId);return this.files.attach({companyId:context.companyId,entityType:ENTITY_TYPE,entityId:contractId,createdBy:context.actorId,label:input.label,contentType:input.contentType?.trim()||'application/octet-stream',content:decodeBase64(input.contentBase64)});
  }

  @Delete(':fileId')
  async remove(@Headers('authorization') auth:string|undefined,@Headers('x-company-id') company:string|undefined,@Headers('x-branch-id') branch:string|undefined,@Param('contractId') contractId:string,@Param('fileId') fileId:string):Promise<{deleted:true}>{
    const context=await this.context(auth,company,branch);await this.authorizeAny(context,MANAGE_PERMISSIONS);await this.requireContract(context,contractId);await this.files.detach(context.companyId,ENTITY_TYPE,contractId,fileId);return{deleted:true};
  }

  private async requireContract(context:ExecutionContext,contractId:string){const contract=await this.contracts.getContract(context.companyId,contractId);if(!contract)throw new NotFoundException('tourism contract not found');return contract;}
  private async authorizeAny(context:ExecutionContext,permissions:readonly string[]){for(const permission of permissions){try{await this.platform.authorize(context.actorId,context.companyId,permission);return;}catch{continue;}}throw new UnauthorizedException('contract inventory permission required');}
  private async context(auth:string|undefined,company:string|undefined,branch:string|undefined):Promise<ExecutionContext>{if(!auth?.startsWith('Bearer ')||!company||!branch)throw new UnauthorizedException('authenticated company and branch context required');const user=await this.platform.currentUser(auth.slice(7));await this.platform.requireBranchAccess(user.id,company,branch);return executionContext(company,branch,user.id);}
}

function decodeBase64(value:string|undefined):Uint8Array{const text=value?.trim();if(!text)throw new Error('contentBase64 is required');const bytes=Buffer.from(text,'base64');if(bytes.byteLength===0)throw new Error('file content is empty');if(bytes.byteLength>10*1024*1024)throw new Error('file exceeds 10 MB limit');return bytes;}
