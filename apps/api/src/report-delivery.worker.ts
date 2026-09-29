import{Inject,Injectable,Logger}from'@nestjs/common';
import type{OnModuleDestroy,OnModuleInit}from'@nestjs/common';
import{OperationalReportingApplicationService,type OperationalReportSchedule}from'@elhafez/operational-reporting';
import{PlatformCoreApplicationService}from'@elhafez/platform-core';

export function reportDeliverySlot(schedule:OperationalReportSchedule,at:Date):string|null{
 if(!schedule.enabled||schedule.channel!=='IN_APP'||at.getUTCHours()!==schedule.hourUtc)return null;
 if(schedule.cadence==='WEEKLY'&&at.getUTCDay()!==schedule.weekday)return null;
 if(schedule.cadence==='MONTHLY'&&at.getUTCDate()!==schedule.dayOfMonth)return null;
 return at.toISOString().slice(0,13);
}

@Injectable()
export class ReportDeliveryWorker implements OnModuleInit,OnModuleDestroy{
 private readonly logger=new Logger(ReportDeliveryWorker.name);private timer:ReturnType<typeof setInterval>|undefined;
 constructor(@Inject(OperationalReportingApplicationService)private readonly reporting:OperationalReportingApplicationService,@Inject(PlatformCoreApplicationService)private readonly platform:PlatformCoreApplicationService){}
 onModuleInit(){void this.runOnce().catch(error=>this.logger.error(error instanceof Error?error.message:'report delivery startup tick failed'));this.timer=setInterval(()=>{void this.runOnce().catch(error=>this.logger.error(error instanceof Error?error.message:'report delivery tick failed'));},60000);this.timer.unref();}
 onModuleDestroy(){if(this.timer)clearInterval(this.timer);}
 async runOnce(at=new Date()){
  let delivered=0;const companies=await this.platform.listAllCompaniesForPlatformControl();
  for(const company of companies){
   let schedules:readonly OperationalReportSchedule[]=[];
   try{schedules=await this.reporting.listSchedulesForDeliveryForIntegration(company.id);}catch(error){this.logger.warn(`report schedules unavailable for ${company.id}: ${error instanceof Error?error.message:'unknown error'}`);continue;}
   for(const schedule of schedules){const slot=reportDeliverySlot(schedule,at);if(!slot)continue;
    try{
     const report=await this.reporting.savedReportForDeliveryForIntegration(company.id,schedule.savedReportId);if(!report?.active)continue;
     const existing=await this.platform.listNotifications(schedule.createdBy,company.id);
     if(existing.some(item=>item.type==='REPORT_SCHEDULE_READY'&&item.payload.scheduleId===schedule.id&&item.payload.deliverySlot===slot))continue;
     await this.platform.notify(schedule.createdBy,'REPORT_SCHEDULE_READY',{title:'تقرير مجدول جاهز',message:`${report.name} — افتح التقرير لقراءة أحدث بيانات من المصدر.`,route:'/management/reports',savedReportId:report.id,reportKey:report.reportKey,filters:report.filters,scheduleId:schedule.id,deliverySlot:slot},company.id);delivered+=1;
    }catch(error){this.logger.warn(`report schedule ${schedule.id} delivery skipped: ${error instanceof Error?error.message:'unknown error'}`);}
   }
  }
  return delivered;
 }
}
