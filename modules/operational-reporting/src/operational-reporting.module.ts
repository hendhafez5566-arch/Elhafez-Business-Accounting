import{Module}from'@nestjs/common';
import{PrismaClient}from'@prisma/client';
import{PlatformCoreApplicationService,PlatformCoreModule}from'@elhafez/platform-core';
import{OPERATIONAL_REPORTING_ACCESS,type OperationalReportingAccess}from'./application/operational-reporting.ports.js';
import{OperationalReportingApplicationService}from'./application/operational-reporting.application-service.js';
import{OPERATIONAL_REPORTING_REPOSITORY,type OperationalReportingRepository}from'./application/operational-reporting.repository.js';
import{OperationalReportingController}from'./infrastructure/operational-reporting.controller.js';
import{PlatformOperationalReportingAccess}from'./infrastructure/platform-operational-reporting.access.js';
import{PrismaOperationalReportingRepository}from'./infrastructure/prisma-operational-reporting.repository.js';

@Module({imports:[PlatformCoreModule],controllers:[OperationalReportingController],providers:[
 PrismaClient,
 {provide:OPERATIONAL_REPORTING_REPOSITORY,useFactory:(db:PrismaClient)=>new PrismaOperationalReportingRepository(db),inject:[PrismaClient]},
 {provide:OPERATIONAL_REPORTING_ACCESS,useFactory:(platform:PlatformCoreApplicationService)=>new PlatformOperationalReportingAccess(platform),inject:[PlatformCoreApplicationService]},
 {provide:OperationalReportingApplicationService,useFactory:(repo:OperationalReportingRepository,access:OperationalReportingAccess)=>new OperationalReportingApplicationService(repo,access),inject:[OPERATIONAL_REPORTING_REPOSITORY,OPERATIONAL_REPORTING_ACCESS]},
],exports:[OperationalReportingApplicationService]})
export class OperationalReportingModule{}
