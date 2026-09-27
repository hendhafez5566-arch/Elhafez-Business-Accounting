import{Body,Controller,Delete,Get,Headers,Inject,Param,Patch,Post,Put,Query,UnauthorizedException}from'@nestjs/common';
import{PlatformCoreApplicationService}from'@elhafez/platform-core';
import{CustomFieldsApplicationService}from'../application/custom-fields.application-service.js';
import type{CreateCustomFieldDefinitionInput,CustomFieldsContext,UpdateCustomFieldDefinitionInput}from'../application/custom-fields.application-service.js';

@Controller('custom-fields')
export class CustomFieldsController{
 constructor(@Inject(CustomFieldsApplicationService)private readonly service:CustomFieldsApplicationService,@Inject(PlatformCoreApplicationService)private readonly platform:PlatformCoreApplicationService){}
 @Get()async list(@Headers('authorization')authorization:string|undefined,@Headers('x-company-id')companyId:string|undefined,@Query('entityType')entityType?:string){return this.service.listDefinitions(await this.context(authorization,companyId),entityType);}
 @Post()async create(@Headers('authorization')authorization:string|undefined,@Headers('x-company-id')companyId:string|undefined,@Body()input:CreateCustomFieldDefinitionInput){return this.service.createDefinition(await this.context(authorization,companyId),input);}
 @Patch(':definitionId')async update(@Headers('authorization')authorization:string|undefined,@Headers('x-company-id')companyId:string|undefined,@Param('definitionId')definitionId:string,@Body()input:UpdateCustomFieldDefinitionInput){return this.service.updateDefinition(await this.context(authorization,companyId),definitionId,input);}
 @Get('values/:entityType/:entityId')async values(@Headers('authorization')authorization:string|undefined,@Headers('x-company-id')companyId:string|undefined,@Param('entityType')entityType:string,@Param('entityId')entityId:string){return this.service.listEntityValues(await this.context(authorization,companyId),entityType,entityId);}
 @Put(':definitionId/values/:entityId')async setValue(@Headers('authorization')authorization:string|undefined,@Headers('x-company-id')companyId:string|undefined,@Param('definitionId')definitionId:string,@Param('entityId')entityId:string,@Body()input:{value:unknown}){return this.service.setValue(await this.context(authorization,companyId),definitionId,entityId,input.value);}
 @Delete(':definitionId/values/:entityId')async clearValue(@Headers('authorization')authorization:string|undefined,@Headers('x-company-id')companyId:string|undefined,@Param('definitionId')definitionId:string,@Param('entityId')entityId:string){await this.service.clearValue(await this.context(authorization,companyId),definitionId,entityId);return{cleared:true};}
 private async context(authorization:string|undefined,companyId:string|undefined):Promise<CustomFieldsContext>{if(!authorization?.startsWith('Bearer ')||!companyId)throw new UnauthorizedException('authenticated company context required');const user=await this.platform.currentUser(authorization.slice(7));return{companyId,actorId:user.id};}
}
