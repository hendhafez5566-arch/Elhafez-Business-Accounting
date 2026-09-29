import{BadRequestException,Controller,Headers,Inject,Param,Post,UnauthorizedException}from'@nestjs/common';
import{OperationalReportingApplicationService,OPERATIONAL_REPORTING_PERMISSIONS,type OperationalReportingContext}from'@elhafez/operational-reporting';
import{PlatformCoreApplicationService}from'@elhafez/platform-core';

@Controller('report-delivery')
export class ReportDeliveryController{
 constructor(@Inject(OperationalReportingApplicationService)private readonly reporting:OperationalReportingApplicationService,@Inject(PlatformCoreApplicationService)private readonly platform:PlatformCoreApplicationService){}
 @Post('schedules/:id/run-now')
 async runNow(@Headers('authorization')authorization:string|undefined,@Headers('x-company-id')companyId:string|undefined,@Headers('x-branch-id')branchId:string|undefined,@Param('id')id:string){
  const context=await this.context(authorization,companyId,branchId);
  const schedule=(await this.reporting.listSchedules(context)).find(row=>row.id===id);
  if(!schedule)throw new BadRequestException('schedule was not found in current company visibility');
  if(!schedule.enabled)throw new BadRequestException('schedule is disabled');
  if(schedule.channel!=='IN_APP')throw new BadRequestException('email delivery integration is not configured');
  const report=(await this.reporting.listSavedReports(context)).find(row=>row.id===schedule.savedReportId);
  if(!report||!report.active)throw new BadRequestException('active saved report is required');
  const notification=await this.platform.notify(schedule.createdBy,'REPORT_SCHEDULE_READY',{
   title:'تقرير مجدول جاهز',
   message:`${report.name} — افتح التقرير لقراءة أحدث بيانات من المصدر.`,
   route:'/management/reports',
   savedReportId:report.id,
   reportKey:report.reportKey,
   filters:report.filters,
   scheduleId:schedule.id,
   deliveryBranchId:branchId,
  },companyId);
  return{status:'DELIVERED' as const,channel:'IN_APP' as const,notificationId:notification.id};
 }
 private async context(authorization:string|undefined,companyId:string|undefined,branchId:string|undefined):Promise<OperationalReportingContext>{
  if(!authorization?.startsWith('Bearer ')||!companyId||!branchId)throw new UnauthorizedException('authenticated company and branch context required');
  const user=await this.platform.currentUser(authorization.slice(7));
  await this.platform.requireBranchAccess(user.id,companyId,branchId);
  await this.platform.authorize(user.id,companyId,OPERATIONAL_REPORTING_PERMISSIONS.manage);
  return{companyId,actorId:user.id};
 }
}