import{randomUUID}from'node:crypto';
import type{OperationalReportDeliveryPort}from'./operational-reporting.ports.js';
import type{OperationalReportingRepository}from'./operational-reporting.repository.js';
import type{OperationalReportDelivery,OperationalReportSchedule}from'../domain/operational-reporting.js';

function latestDueSlot(schedule:OperationalReportSchedule,now:Date):Date|null{
 const hour=schedule.hourUtc,at=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate(),hour,0,0,0));
 let candidate=at;
 if(schedule.cadence==='WEEKLY'){const weekday=schedule.weekday!;const delta=(now.getUTCDay()-weekday+7)%7;candidate=new Date(at.getTime()-delta*86400000);if(candidate>now)candidate=new Date(candidate.getTime()-7*86400000);}
 else if(schedule.cadence==='MONTHLY'){candidate=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),schedule.dayOfMonth!,hour,0,0,0));if(candidate>now)candidate=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-1,schedule.dayOfMonth!,hour,0,0,0));}
 else if(candidate>now)candidate=new Date(candidate.getTime()-86400000);
 const activation=new Date(schedule.updatedAt);
 return candidate>=activation?candidate:null;
}
function reportBody(name:string,key:string,filters:Readonly<Record<string,unknown>>){return[
 'تقرير مجدول من ELHAFEZ BUSINESS PLATFORM',
 'التقرير: '+name,
 'النوع: '+key,
 'الفلاتر المحفوظة: '+JSON.stringify(filters),
 'افتح مركز التقارير لاستعراض البيانات الحالية وفق النطاق والصلاحيات المعتمدة.'
].join('\n');}

export class OperationalReportDeliveryRunner{
 constructor(private readonly repo:OperationalReportingRepository,private readonly delivery:OperationalReportDeliveryPort,private readonly now:()=>Date=()=>new Date(),private readonly newId:()=>string=()=>randomUUID()){}
 async reserveCurrentSlots(limit=200){
  const now=this.now(),schedules=await this.repo.listEnabledSchedules(),out:OperationalReportDelivery[]=[];
  for(const schedule of schedules){
   if(out.length>=limit)break;
   const report=await this.repo.findSavedReport(schedule.companyId,schedule.savedReportId);if(!report?.active)continue;
   const slot=latestDueSlot(schedule,now);if(!slot)continue;
   const at=now.toISOString(),scheduledFor=slot.toISOString();
   out.push(await this.repo.reserveDelivery({id:this.newId(),companyId:schedule.companyId,scheduleId:schedule.id,savedReportId:schedule.savedReportId,scheduledFor,channel:schedule.channel,recipient:schedule.recipient,status:'PENDING',attempt:0,maxAttempts:5,nextAttemptAt:at,providerReference:null,lastError:null,createdAt:at,updatedAt:at}));
  }
  return out;
 }
 async processDue(limit=50){
  await this.reserveCurrentSlots(Math.max(limit*2,100));
  const claimed=await this.repo.claimDueDeliveries(this.now().toISOString(),limit),out:OperationalReportDelivery[]=[];
  for(const item of claimed){
   const report=await this.repo.findSavedReport(item.companyId,item.savedReportId),schedule=(await this.repo.listSchedules(item.companyId,item.savedReportId)).find(row=>row.id===item.scheduleId);
   if(!report?.active||!schedule?.enabled){out.push(await this.finish(item,'DEAD_LETTER',null,'report or schedule is inactive'));continue;}
   const payload={title:'تقرير مجدول: '+report.name,body:reportBody(report.name,report.reportKey,report.filters),reportKey:report.reportKey,filters:report.filters,route:'/management/reports?savedReportId='+encodeURIComponent(report.id),scheduledFor:item.scheduledFor};
   try{
    const result=item.channel==='IN_APP'?await this.delivery.sendInApp(item.companyId,schedule.createdBy,payload):await this.delivery.sendEmail(item.companyId,item.recipient!,payload);
    out.push(await this.finish(item,'SENT',result.reference??null,null));
   }catch(error){
    const final=item.attempt>=item.maxAttempts,status=final?'DEAD_LETTER':'RETRY',message=error instanceof Error?error.message:'scheduled report delivery failed';
    out.push(await this.finish(item,status,null,message));
   }
  }
  return out;
 }
 private finish(item:OperationalReportDelivery,status:'SENT'|'RETRY'|'DEAD_LETTER',reference:string|null,error:string|null){
  const now=this.now(),delay=Math.min(3600,30*2**Math.max(0,item.attempt-1))*1000;
  return this.repo.saveDelivery({...item,status,providerReference:reference,lastError:error,nextAttemptAt:status==='RETRY'?new Date(now.getTime()+delay).toISOString():item.nextAttemptAt,updatedAt:now.toISOString()});
 }
}
