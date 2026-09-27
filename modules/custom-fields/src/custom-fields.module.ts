import{Module}from'@nestjs/common';
import{PrismaClient}from'@prisma/client';
import{PlatformCoreApplicationService,PlatformCoreModule}from'@elhafez/platform-core';
import{CUSTOM_FIELDS_ACCESS,type CustomFieldsAccess}from'./application/custom-fields.access.js';
import{CustomFieldsApplicationService}from'./application/custom-fields.application-service.js';
import{CUSTOM_FIELDS_REPOSITORY,type CustomFieldsRepository}from'./application/custom-fields.repository.js';
import{CustomFieldsController}from'./infrastructure/custom-fields.controller.js';
import{PlatformCustomFieldsAccess}from'./infrastructure/platform-custom-fields.access.js';
import{PrismaCustomFieldsRepository}from'./infrastructure/prisma-custom-fields.repository.js';
@Module({imports:[PlatformCoreModule],controllers:[CustomFieldsController],providers:[PrismaClient,{provide:CUSTOM_FIELDS_REPOSITORY,useFactory:(db:PrismaClient)=>new PrismaCustomFieldsRepository(db),inject:[PrismaClient]},{provide:CUSTOM_FIELDS_ACCESS,useFactory:(platform:PlatformCoreApplicationService)=>new PlatformCustomFieldsAccess(platform),inject:[PlatformCoreApplicationService]},{provide:CustomFieldsApplicationService,useFactory:(repo:CustomFieldsRepository,access:CustomFieldsAccess)=>new CustomFieldsApplicationService(repo,access),inject:[CUSTOM_FIELDS_REPOSITORY,CUSTOM_FIELDS_ACCESS]}],exports:[CustomFieldsApplicationService]})
export class CustomFieldsModule{}
