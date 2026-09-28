export interface TenantBranch { readonly id:string; readonly name:string; readonly active:boolean; readonly companyId:string; }
export interface TenantSubscription { readonly status:string; readonly allowed:boolean; readonly reason:string|null; readonly currentPeriodEnd?:string|null; readonly gracePeriodEnd?:string|null; }
export interface TenantSession {
 readonly token:string;
 readonly userId:string;
 readonly username:string;
 readonly mustChangePassword:boolean;
 readonly mfaEnabled:boolean;
 readonly expiresAt:string;
 readonly companyId:string;
 readonly companyCode:string;
 readonly companyName:string;
 readonly branches:readonly TenantBranch[];
 readonly branchId:string;
 readonly subscription:TenantSubscription;
}
export interface TenantApiContext { readonly token:string; readonly companyId:string; readonly branchId:string; }

const STORAGE_KEY='elhafez.tenantSession';
export const TENANT_SESSION_EVENT='elhafez:tenant-session';

function storage():Storage|undefined{
 if(typeof window==='undefined')return undefined;
 try{return window.sessionStorage;}catch{return undefined;}
}
function valid(value:unknown):value is TenantSession{
 if(!value||typeof value!=='object')return false;
 const v=value as Partial<TenantSession>;
 return typeof v.token==='string'&&Boolean(v.token)&&typeof v.userId==='string'&&Boolean(v.userId)&&typeof v.username==='string'&&Boolean(v.username)&&typeof v.mustChangePassword==='boolean'&&typeof v.mfaEnabled==='boolean'&&typeof v.companyId==='string'&&Boolean(v.companyId)&&typeof v.branchId==='string'&&Boolean(v.branchId)&&typeof v.companyCode==='string'&&typeof v.companyName==='string'&&Boolean(v.companyName)&&Array.isArray(v.branches)&&typeof v.expiresAt==='string'&&Boolean(v.subscription)&&typeof v.subscription?.allowed==='boolean';
}
function emit(){if(typeof window!=='undefined')window.dispatchEvent(new Event(TENANT_SESSION_EVENT));}
export function readTenantSession():TenantSession|null{
 const value=storage()?.getItem(STORAGE_KEY);if(!value)return null;
 try{const parsed=JSON.parse(value) as unknown;if(!valid(parsed)){storage()?.removeItem(STORAGE_KEY);return null;}if(Date.parse(parsed.expiresAt)<=Date.now()){storage()?.removeItem(STORAGE_KEY);return null;}return parsed;}catch{storage()?.removeItem(STORAGE_KEY);return null;}
}
export function writeTenantSession(value:TenantSession){storage()?.setItem(STORAGE_KEY,JSON.stringify(value));emit();return value;}
export function clearTenantSession(){storage()?.removeItem(STORAGE_KEY);emit();}
export function selectTenantBranch(branchId:string){
 const current=readTenantSession();if(!current)throw new Error('tenant session required');
 const branch=current.branches.find(value=>value.id===branchId&&value.active);if(!branch)throw new Error('branch is not available');
 return writeTenantSession({...current,branchId:branch.id});
}
export function tenantApiContext():TenantApiContext{
 const current=readTenantSession();return current?{token:current.token,companyId:current.companyId,branchId:current.branchId}:{token:'',companyId:'',branchId:''};
}
