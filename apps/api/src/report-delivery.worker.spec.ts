import test from'node:test';
import assert from'node:assert/strict';
import{ReportDeliveryWorker,reportDeliverySlot}from'./report-delivery.worker.js';

const schedule={id:'schedule-1',companyId:'company-1',savedReportId:'report-1',cadence:'DAILY' as const,hourUtc:8,weekday:null,dayOfMonth:null,channel:'IN_APP' as const,recipient:null,enabled:true,createdBy:'user-1',createdAt:'2026-09-29T00:00:00.000Z',updatedAt:'2026-09-29T00:00:00.000Z'};

test('delivery slot honors cadence hour weekday and monthly day',()=>{
 assert.equal(reportDeliverySlot(schedule,new Date('2026-09-29T08:15:00Z')),'2026-09-29T08');
 assert.equal(reportDeliverySlot(schedule,new Date('2026-09-29T09:00:00Z')),null);
 assert.equal(reportDeliverySlot({...schedule,cadence:'WEEKLY',weekday:2},new Date('2026-09-29T08:00:00Z')),'2026-09-29T08');
 assert.equal(reportDeliverySlot({...schedule,cadence:'MONTHLY',dayOfMonth:30},new Date('2026-09-29T08:00:00Z')),null);
});

test('worker delivers due in-app schedule once per UTC hour slot',async()=>{
 const notifications:{type:string;payload:Record<string,unknown>}[]=[];
 const reporting={listSchedulesForDeliveryForIntegration:async()=>[schedule],savedReportForDeliveryForIntegration:async()=>({id:'report-1',name:'تقرير يومي',reportKey:'EXECUTIVE_OVERVIEW',filters:{scope:'CURRENT_COMPANY_BRANCH'},active:true})};
 const platform={listAllCompaniesForPlatformControl:async()=>[{id:'company-1'}],listNotifications:async()=>notifications,notify:async(_user:string,type:string,payload:Record<string,unknown>)=>{notifications.push({type,payload});return{id:'notification-1'};}};
 const worker=new ReportDeliveryWorker(reporting as never,platform as never);
 assert.equal(await worker.runOnce(new Date('2026-09-29T08:05:00Z')),1);
 assert.equal(await worker.runOnce(new Date('2026-09-29T08:45:00Z')),0);
 assert.equal(notifications.length,1);
 assert.equal(notifications[0]?.payload.deliverySlot,'2026-09-29T08');
});
