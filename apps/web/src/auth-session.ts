export const TENANT_SESSION_KEY='elhafez.tenantSession.v1';
export const TENANT_SESSION_EVENT='elhafez:tenant-session-changed';

export interface TenantSession{
 readonly token:string;
 readonly userId:string;
 readonly expiresAt:string;
 readonly companyId:string;
 readonly companyCode:string;
 readonly companyName:string;
 readonly branchId:string;
 readonly branchName:string;
 readonly subscriptionStatus:string;
 readonly subscriptionAllowed:boolean;
}

function browserStore():Storage|undefined{
 if(typeof window==='undefined')return undefined;
 try{return window.sessionStorage;}catch{return undefined;}
}

function valid(value:unknown):value is TenantSession{
 if(!value||typeof value!=='object')return false;
 const v=value as Record<string,unknown>;
 return['token','userId','expiresAt','companyId','companyCode','companyName','branchId','branchName','subscriptionStatus'].every(key=>typeof v[key]==='string')
  &&typeof v.subscriptionAllowed==='boolean';
}

export function loadTenantSession(now=Date.now()):TenantSession|null{
 const store=browserStore();if(!store)return null;
 const raw=store.getItem(TENANT_SESSION_KEY);if(!raw)return null;
 try{
  const parsed:unknown=JSON.parse(raw);
  if(!valid(parsed)||Date.parse(parsed.expiresAt)<=now){clearTenantSession();return null;}
  return parsed;
 }catch{clearTenantSession();return null;}
}

export function saveTenantSession(session:TenantSession){
 const store=browserStore();if(!store)return;
 store.setItem(TENANT_SESSION_KEY,JSON.stringify(session));
 // Remove the pre-FC-01 ad-hoc persistent token keys so an old localStorage token cannot outlive the canonical session.
 try{
  window.localStorage.removeItem('elhafez.sessionToken');
  window.localStorage.removeItem('elhafez.companyId');
  window.localStorage.removeItem('elhafez.branchId');
 }catch{}
 window.dispatchEvent(new Event(TENANT_SESSION_EVENT));
}

export function clearTenantSession(){
 const store=browserStore();store?.removeItem(TENANT_SESSION_KEY);
 if(typeof window!=='undefined')window.dispatchEvent(new Event(TENANT_SESSION_EVENT));
}

export function tenantRequestContext(){
 const session=loadTenantSession();
 return session?{token:session.token,companyId:session.companyId,branchId:session.branchId}:{token:'',companyId:'',branchId:''};
}
