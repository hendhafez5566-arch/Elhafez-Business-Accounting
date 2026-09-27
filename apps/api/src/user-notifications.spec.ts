import assert from'node:assert/strict';import test from'node:test';
import{UserNotificationsController}from'./user-notifications.controller.js';

test('notification self-service resolves actor and always scopes reads to active company',async()=>{
 const calls:Array<unknown[]>=[],notice={id:'n1',userId:'u1',companyId:'c1',type:'notice',payload:{},readAt:null,createdAt:new Date()};
 const platform={
  currentUser:async(token:string)=>{assert.equal(token,'session');return{id:'u1'};},
  requireBranchAccess:async(...args:unknown[])=>{calls.push(['branch',...args]);},
  listNotifications:async(...args:unknown[])=>{calls.push(['list',...args]);return[notice];},
  markNotificationRead:async(...args:unknown[])=>{calls.push(['read',...args]);return{...notice,readAt:new Date()};},
  markAllNotificationsRead:async(...args:unknown[])=>{calls.push(['read-all',...args]);return 1;}
 };
 const controller=new UserNotificationsController(platform as never);
 const listed=await controller.list('Bearer session','c1','b1');
 assert.equal(listed.unreadCount,1);
 await controller.read('Bearer session','c1','b1','n1');
 assert.deepEqual(await controller.readAll('Bearer session','c1','b1'),{updated:1});
 assert.deepEqual(calls,[['branch','u1','c1','b1'],['list','u1','c1'],['branch','u1','c1','b1'],['read','u1','n1','c1'],['branch','u1','c1','b1'],['read-all','u1','c1']]);
 await assert.rejects(()=>controller.list(undefined,'c1','b1'),/authenticated company and branch context required/);
});
