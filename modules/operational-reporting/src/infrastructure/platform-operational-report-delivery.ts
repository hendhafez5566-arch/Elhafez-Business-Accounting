import{type CompanyId}from'@elhafez/contracts';
import type{PlatformCoreApplicationService}from'@elhafez/platform-core';
import type{IntegrationHubApplicationService}from'@elhafez/integration-hub';
import type{OperationalReportDeliveryPort}from'../application/operational-reporting.ports.js';
export class PlatformOperationalReportDelivery implements OperationalReportDeliveryPort{
 constructor(private readonly platform:PlatformCoreApplicationService,private readonly integrations:IntegrationHubApplicationService){}
 async sendInApp(companyId:string,userId:string,payload:Readonly<Record<string,unknown>>){const n=await this.platform.notify(userId,'report.scheduled',payload as Record<string,unknown>,companyId);return{reference:n.id};}
 async sendEmail(companyId:string,recipient:string,payload:Readonly<Record<string,unknown>>){const result=await this.integrations.dispatchMessage(companyId as CompanyId,'EMAIL',{recipient,...payload});return{reference:result.reference};}
}
