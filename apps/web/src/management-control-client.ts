import { crmRequest } from './crm-core-client.js';

export type ManagementDomain = 'CRM_SALES' | 'SUPPLIERS_PROCUREMENT' | 'HAJJ_UMRAH' | 'FINANCE';
export type AttentionSeverity = 'CRITICAL' | 'HIGH' | 'NORMAL';
export interface ManagementAttentionItem { readonly sourceKey:string; readonly sourceDomain:ManagementDomain; readonly sourceType:string; readonly sourceId:string; readonly title:string; readonly summary:string; readonly severity:AttentionSeverity; readonly status:string; readonly companyId:string; readonly branchId?:string; readonly occurredAt?:string; readonly category:string; readonly drillDownPath:string; }
export interface ManagementSummary {
  readonly crmSales:{ readonly customers:number; readonly agents:number; readonly travelers:number; readonly overdueFollowups:number; readonly leadStages:Readonly<Record<string,number>>; readonly quotationStatuses:Readonly<Record<string,number>>; readonly quotationValueByCurrency:readonly { readonly currency:string; readonly total:string }[] };
  readonly suppliers:{ readonly total:number; readonly openDisputes:number; readonly activeHolds:number };
  readonly hajjUmrah:{ readonly activePrograms:number; readonly readinessItems:number; readonly criticalReadinessItems:number };
  readonly finance:{ readonly overduePositions:number; readonly overdueByCurrency:readonly { readonly currency:string; readonly amount:string }[] };
}
export interface ManagementOverview { readonly generatedAt:string; readonly totals:{ readonly attention:number; readonly critical:number; readonly high:number }; readonly domains:readonly { readonly domain:ManagementDomain; readonly count:number }[]; readonly summary:ManagementSummary; readonly items:readonly ManagementAttentionItem[]; }
export interface ManagementFilters { readonly domain?:ManagementDomain; readonly severity?:AttentionSeverity; readonly status?:string; readonly category?:string; readonly from?:string; readonly to?:string; }
export interface ManagementControlApi { overview(filters?:ManagementFilters):Promise<ManagementOverview> }
export type ManagementRequest = (path:string)=>Promise<ManagementOverview>;
export function createManagementControlApi(request:ManagementRequest=crmRequest):ManagementControlApi { return { overview:(filters={})=>{ const query=new URLSearchParams(); for(const [key,value] of Object.entries(filters)) if(value) query.set(key,value); return request(`/management-control/overview${query.size?`?${query.toString()}`:''}`); } }; }
export const managementControlApi=createManagementControlApi();
