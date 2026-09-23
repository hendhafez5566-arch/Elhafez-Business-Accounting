import type{ExecutionContext}from'@elhafez/contracts';
import type{FinancialReportingApplicationService}from'@elhafez/financial-reporting';
import type{HajjUmrahProgramsApplicationService}from'@elhafez/hajj-umrah-programs';
import type{HajjUmrahReadinessApplicationService}from'@elhafez/hajj-umrah-readiness';
import type{PlatformCoreApplicationService}from'@elhafez/platform-core';
export type ManagementDomain='CRM_SALES'|'SUPPLIERS_PROCUREMENT'|'HAJJ_UMRAH'|'FINANCE'|'PLATFORM';
export type AttentionSeverity='CRITICAL'|'HIGH'|'NORMAL';
export interface ManagementAttentionItem{
 readonly sourceKey:string;readonly sourceDomain:ManagementDomain;readonly sourceType:string;readonly sourceId:string;
 readonly title:string;readonly summary:string;readonly severity:AttentionSeverity;readonly status:string;
 readonly companyId:string;readonly branchId?:string;readonly occurredAt?:string;readonly category:string;readonly drillDownPath:string;
}
export interface WorkCenterFilter{readonly domain?:ManagementDomain;readonly severity?:AttentionSeverity;readonly status?:string;readonly category?:string;readonly from?:string;readonly to?:string;}
export interface ManagementOverview{readonly generatedAt:string;readonly totals:{readonly attention:number;readonly critical:number;readonly high:number;readonly unreadNotifications:number};readonly domains:readonly {readonly domain:ManagementDomain;readonly count:number}[];readonly items:readonly ManagementAttentionItem[];}

export class WorkCenterApplicationService{
 compose(companyId:string,branchId:string,items:readonly ManagementAttentionItem[],filter:WorkCenterFilter={},generatedAt=new Date().toISOString()):ManagementOverview{
  const scoped=items.filter(item=>item.companyId===companyId&&(!item.branchId||item.branchId===branchId));
  const selected=scoped.filter(item=>(!filter.domain||item.sourceDomain===filter.domain)&&(!filter.severity||item.severity===filter.severity)&&(!filter.status||item.status===filter.status)&&(!filter.category||item.category===filter.category)&&(!filter.from||Boolean(item.occurredAt&&item.occurredAt>=filter.from))&&(!filter.to||Boolean(item.occurredAt&&item.occurredAt<=filter.to)));
  const order:Record<AttentionSeverity,number>={CRITICAL:0,HIGH:1,NORMAL:2};
  const sorted=[...selected].sort((a,b)=>order[a.severity]-order[b.severity]||(b.occurredAt??'').localeCompare(a.occurredAt??'')||a.sourceKey.localeCompare(b.sourceKey));
  const domains=(['CRM_SALES','SUPPLIERS_PROCUREMENT','HAJJ_UMRAH','FINANCE','PLATFORM']as const).map(domain=>({domain,count:scoped.filter(item=>item.sourceDomain===domain).length}));
  return{generatedAt,totals:{attention:scoped.length,critical:scoped.filter(x=>x.severity==='CRITICAL').length,high:scoped.filter(x=>x.severity==='HIGH').length,unreadNotifications:scoped.filter(x=>x.sourceType==='NOTIFICATION'&&x.status==='UNREAD').length},domains,items:sorted};
 }
}


import type{CrmSalesReadModelService}from'./crm-sales-read-model.service.js';
import type{SupplierIntelligenceReadModelService}from'./supplier-intelligence-read-model.service.js';

export const MANAGEMENT_CONTROL_PERMISSION='management.control.read';
type CrmRead=Pick<CrmSalesReadModelService,'dashboard'>;type SupplierRead=Pick<SupplierIntelligenceReadModelService,'searchSuppliers'|'overview'>;type ProgramRead=Pick<HajjUmrahProgramsApplicationService,'list'>;type ReadinessRead=Pick<HajjUmrahReadinessApplicationService,'workQueue'>;type ReportingRead=Pick<FinancialReportingApplicationService,'aging'>;type PlatformRead=Pick<PlatformCoreApplicationService,'listNotifications'>;
export class ManagementControlService{
 constructor(private readonly workCenter:WorkCenterApplicationService,private readonly crm:CrmRead,private readonly suppliers:SupplierRead,private readonly programs:ProgramRead,private readonly readiness:ReadinessRead,private readonly reporting:ReportingRead,private readonly platform:PlatformRead,private readonly now:()=>Date=()=>new Date()){}
 async overview(context:ExecutionContext,filter:WorkCenterFilter={}):Promise<ManagementOverview>{
  const[crm,supplierItems,hajjItems,aging,notifications]=await Promise.all([this.crm.dashboard(context),this.supplierAttention(context),this.hajjAttention(context),this.reporting.aging({companyId:context.companyId,branchIds:[context.branchId]},'CUSTOMER'),this.platform.listNotifications(context.actorId)]);
  const items:ManagementAttentionItem[]=[];
  for(const row of crm.attention.overdueFollowups)items.push(this.item(context,'CRM_SALES','FOLLOWUP',row.id,'متابعة عميل متأخرة',row.nextAction??`متابعة العميل المحتمل ${row.leadId}`,'HIGH','OVERDUE','FOLLOW_UP','/crm/followups',row.scheduledAt));
  for(const row of crm.attention.awaitingApproval)items.push(this.item(context,'CRM_SALES','QUOTATION',row.id,'عرض سعر ينتظر الموافقة',`عرض السعر ${row.number}`,'HIGH','PENDING','APPROVAL','/crm/quotations',row.updatedAt));
  for(const row of crm.attention.awaitingConversion)items.push(this.item(context,'CRM_SALES','QUOTATION',row.id,'عرض سعر مقبول ينتظر التحويل',`عرض السعر ${row.number}`,'NORMAL','ACCEPTED','CONVERSION','/crm/quotations',row.updatedAt));
  items.push(...supplierItems,...hajjItems);
  const today=this.now().toISOString().slice(0,10);
  for(const row of aging.positions.filter(value=>Boolean(value.dueDate&&value.dueDate<today)))items.push(this.item(context,'FINANCE','RECEIVABLE',row.evidenceId,'ذمة عميل مستحقة',`مبلغ مستحق ${row.openAmount} ${row.currency}`,'HIGH','OVERDUE','FINANCIAL','/management/exceptions',row.dueDate));
  for(const row of notifications.filter(value=>!value.readAt))items.push(this.item(context,'PLATFORM','NOTIFICATION',row.id,'إشعار يتطلب الاطلاع',row.type,'NORMAL','UNREAD','NOTIFICATION','/system-administration',row.createdAt.toISOString(),false));
  return this.workCenter.compose(context.companyId,context.branchId,items,filter,this.now().toISOString());
 }
 private async supplierAttention(c:ExecutionContext):Promise<ManagementAttentionItem[]>{const suppliers=await this.suppliers.searchSuppliers(c);const views=await Promise.all(suppliers.map(row=>this.suppliers.overview(c,row.party.id)));return views.flatMap(view=>[...view.disputes.open.map(row=>this.item(c,'SUPPLIERS_PROCUREMENT','SUPPLIER_DISPUTE',row.id,'نزاع مورد مفتوح',`${view.supplier.party.displayName}: ${row.title}`,row.severity==='CRITICAL'?'CRITICAL':row.severity==='HIGH'?'HIGH':'NORMAL',row.status,'DISPUTE','/procurement/supplier-intelligence',row.openedAt)),...view.holds.active.map(row=>this.item(c,'SUPPLIERS_PROCUREMENT','SUPPLIER_HOLD',row.id,'إيقاف مورد نشط',`${view.supplier.party.displayName}: ${row.reason}`,'HIGH','ACTIVE','HOLD','/procurement/supplier-intelligence',row.createdAt))]);}
 private async hajjAttention(c:ExecutionContext):Promise<ManagementAttentionItem[]>{const programs=await this.programs.list(c);const queues=await Promise.all(programs.filter(program=>program.status!=='CLOSED').map(async program=>({program,items:await this.readiness.workQueue(c,program.id)})));return queues.flatMap(({program,items})=>items.map(row=>this.item(c,'HAJJ_UMRAH',row.reference?.sourceType??'READINESS',row.reference?.sourceId??row.key,`${program.code} — ${row.title}`,row.detail,row.priority,'OPEN',row.category,'/hajj-umrah/readiness',row.dueAt)));}
 private item(c:ExecutionContext,domain:ManagementAttentionItem['sourceDomain'],type:string,id:string,title:string,summary:string,severity:ManagementAttentionItem['severity'],status:string,category:string,path:string,occurredAt?:string,branchScoped=true):ManagementAttentionItem{return{sourceKey:`${type}:${id}`,sourceDomain:domain,sourceType:type,sourceId:id,title,summary,severity,status,companyId:c.companyId,...(branchScoped?{branchId:c.branchId}:{}),...(occurredAt?{occurredAt}:{}),category,drillDownPath:path};}
}
