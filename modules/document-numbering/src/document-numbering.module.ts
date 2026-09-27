import{Module}from'@nestjs/common';
import{PrismaClient}from'@prisma/client';
import{PlatformCoreApplicationService,PlatformCoreModule}from'@elhafez/platform-core';
import{DOCUMENT_NUMBERING_ACCESS,type DocumentNumberingAccess}from'./application/document-numbering.access.js';
import{DocumentNumberingApplicationService}from'./application/document-numbering.application-service.js';
import{DOCUMENT_NUMBERING_REPOSITORY,type DocumentNumberingRepository}from'./application/document-numbering.repository.js';
import{DocumentNumberingController}from'./infrastructure/document-numbering.controller.js';
import{PlatformDocumentNumberingAccess}from'./infrastructure/platform-document-numbering.access.js';
import{PrismaDocumentNumberingRepository}from'./infrastructure/prisma-document-numbering.repository.js';
@Module({imports:[PlatformCoreModule],controllers:[DocumentNumberingController],providers:[PrismaClient,{provide:DOCUMENT_NUMBERING_REPOSITORY,useFactory:(db:PrismaClient)=>new PrismaDocumentNumberingRepository(db),inject:[PrismaClient]},{provide:DOCUMENT_NUMBERING_ACCESS,useFactory:(platform:PlatformCoreApplicationService)=>new PlatformDocumentNumberingAccess(platform),inject:[PlatformCoreApplicationService]},{provide:DocumentNumberingApplicationService,useFactory:(repo:DocumentNumberingRepository,access:DocumentNumberingAccess)=>new DocumentNumberingApplicationService(repo,access),inject:[DOCUMENT_NUMBERING_REPOSITORY,DOCUMENT_NUMBERING_ACCESS]}],exports:[DocumentNumberingApplicationService]})
export class DocumentNumberingModule{}
