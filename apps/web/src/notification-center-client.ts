import{crmRequest,type CrmApiContext}from'./crm-core-client.js';
export interface NotificationItem{readonly id:string;readonly userId:string;readonly companyId:string|null;readonly type:string;readonly payload:Readonly<Record<string,unknown>>;readonly readAt:string|null;readonly createdAt:string}
export interface NotificationCenterData{readonly items:readonly NotificationItem[];readonly unreadCount:number}
export interface NotificationCenterClient{list(context:CrmApiContext):Promise<NotificationCenterData>;read(context:CrmApiContext,id:string):Promise<NotificationItem>;readAll(context:CrmApiContext):Promise<{updated:number}>}
export class HttpNotificationCenterClient implements NotificationCenterClient{
 async list(context:CrmApiContext){return crmRequest<NotificationCenterData>('/notifications',{},context);}
 async read(context:CrmApiContext,id:string){return crmRequest<NotificationItem>('/notifications/'+encodeURIComponent(id)+'/read',{method:'POST',body:'{}'},context);}
 async readAll(context:CrmApiContext){return crmRequest<{updated:number}>('/notifications/read-all',{method:'POST',body:'{}'},context);}
}
