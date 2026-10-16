import { readTenantSession } from './tenant-session.js';
import type { DraftScope } from './followup-draft-store.js';
export interface DetachedProfile {readonly scope:DraftScope;readonly label:string;}
const storageKey='elhafez.detached-profiles.v1';
/** Opt-in device index contains display labels and scope only, never a bearer token or secret. */
export function detachedProfiles():readonly DetachedProfile[]{
 try{const rows:unknown=JSON.parse(localStorage.getItem(storageKey)??'[]');if(!Array.isArray(rows))return [];return rows.filter((x):x is DetachedProfile=>!!x&&typeof x.label==='string'&&typeof x.scope?.companyId==='string'&&typeof x.scope?.branchId==='string'&&typeof x.scope?.userId==='string');}catch{return [];}
}
export function registerDetachedProfile(expectedScope?:DraftScope){
 const session=readTenantSession();if(!session)throw Error('يلزم تسجيل الدخول لتجهيز الجهاز.');
 const scope={companyId:session.companyId,branchId:session.branchId,userId:session.userId},branch=session.branches.find(x=>x.id===session.branchId);
 if(expectedScope&&(scope.companyId!==expectedScope.companyId||scope.branchId!==expectedScope.branchId||scope.userId!==expectedScope.userId))throw Error('تغير حساب الجهاز أثناء الحفظ؛ افتح النطاق الأصلي لمتابعة السجل.');
 const rows=detachedProfiles().filter(x=>JSON.stringify(x.scope)!==JSON.stringify(scope));
 localStorage.setItem(storageKey,JSON.stringify([...rows,{scope,label:session.companyName+' / '+(branch?.name??'الفرع')+' / '+session.username}]));
}
