import{Module}from'@nestjs/common';
import{PrismaClient}from'@prisma/client';
import{PlatformCoreApplicationService,PlatformCoreModule}from'@elhafez/platform-core';
import{FinancialControlsApplicationService,TRUSTED_AUTHORIZATION_PORT,type TrustedAuthorizationPort}from'./application/financial-controls.application-service.js';
import{FINANCIAL_CONTROLS_REPOSITORY,type FinancialControlsRepository}from'./application/financial-controls.repository.js';
import{PrismaFinancialControlsRepository}from'./infrastructure/prisma-financial-controls.repository.js';
import{PlatformFinancialControlsAuthorization}from'./infrastructure/platform-financial-controls.authorization.js';
import{HistoricalImportApplicationService}from'./application/historical-import.application-service.js';
import{HISTORICAL_IMPORT_REPOSITORY,type HistoricalImportRepository}from'./application/historical-import.repository.js';
import{PrismaHistoricalImportRepository}from'./infrastructure/prisma-historical-import.repository.js';

@Module({
 imports:[PlatformCoreModule],
 providers:[
  PrismaClient,
  {provide:HISTORICAL_IMPORT_REPOSITORY,useFactory:(p:PrismaClient)=>new PrismaHistoricalImportRepository(p),inject:[PrismaClient]},
  {provide:HistoricalImportApplicationService,useFactory:(r:HistoricalImportRepository)=>new HistoricalImportApplicationService(r),inject:[HISTORICAL_IMPORT_REPOSITORY]},
  {provide:TRUSTED_AUTHORIZATION_PORT,useFactory:(platform:PlatformCoreApplicationService):TrustedAuthorizationPort=>new PlatformFinancialControlsAuthorization(platform),inject:[PlatformCoreApplicationService]},
  {provide:FINANCIAL_CONTROLS_REPOSITORY,useFactory:(db:PrismaClient)=>new PrismaFinancialControlsRepository(db),inject:[PrismaClient]},
  {provide:FinancialControlsApplicationService,useFactory:(repository:FinancialControlsRepository,authorization:TrustedAuthorizationPort)=>new FinancialControlsApplicationService(repository,authorization),inject:[FINANCIAL_CONTROLS_REPOSITORY,TRUSTED_AUTHORIZATION_PORT]},
 ],
 exports:[HistoricalImportApplicationService,FinancialControlsApplicationService],
})
export class FinancialControlsModule{}
