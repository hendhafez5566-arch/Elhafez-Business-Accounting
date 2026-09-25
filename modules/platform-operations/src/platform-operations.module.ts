import{Module}from'@nestjs/common';
import{PrismaClient}from'@prisma/client';
import{PlatformCoreApplicationService,PlatformCoreModule}from'@elhafez/platform-core';
import{PlatformOperationsApplicationService,type BackupProvider}from'./application/platform-operations.application-service.js';
import{PrismaOperationsRepository}from'./infrastructure/prisma-operations.repository.js';
import{PostgresBackupProvider}from'./infrastructure/postgres-backup.provider.js';

const REPOSITORY=Symbol('OPERATIONS_REPOSITORY'),PROVIDER=Symbol('BACKUP_PROVIDER');

@Module({
 imports:[PlatformCoreModule],
 providers:[
  PrismaClient,
  {provide:REPOSITORY,useFactory:(p:PrismaClient)=>new PrismaOperationsRepository(p),inject:[PrismaClient]},
  {provide:PROVIDER,useFactory:():BackupProvider=>PostgresBackupProvider.fromEnvironment()},
  {provide:PlatformOperationsApplicationService,useFactory:(r:PrismaOperationsRepository,p:BackupProvider,core:PlatformCoreApplicationService)=>new PlatformOperationsApplicationService(r,p,{revokeScope:async companyId=>companyId?core.revokeCompanySessions(companyId):core.revokeAllSessions()}),inject:[REPOSITORY,PROVIDER,PlatformCoreApplicationService]},
 ],
 exports:[PlatformOperationsApplicationService],
})
export class PlatformOperationsModule{}
