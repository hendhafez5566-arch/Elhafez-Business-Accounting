import type{TenantSession,TenantSubscription,TenantBranch}from'./tenant-session.js';
type LoginResponse={token:string;userId:string;expiresAt:string|Date;companyId:string;companyCode:string;branches:TenantBranch[];defaultBranchId:string;subscription:TenantSubscription};
export class TenantAuthClient{
 constructor(private readonly base='/api'){}
 async login(input:{companyCode:string;email:string;password:string}):Promise<TenantSession>{
  const response=await fetch(this.base+'/saas/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});
  const body=await response.json().catch(()=>({})) as Partial<LoginResponse>&{message?:string};
  if(!response.ok)throw new Error(body.message??'تعذر تسجيل الدخول. تحقق من كود الشركة وبيانات الدخول.');
  if(!body.token||!body.companyId||!body.companyCode||!body.userId||!body.expiresAt||!body.defaultBranchId||!body.branches||!body.subscription)throw new Error('استجابة تسجيل الدخول غير مكتملة.');
  return{token:body.token,userId:body.userId,expiresAt:new Date(body.expiresAt).toISOString(),companyId:body.companyId,companyCode:body.companyCode,branches:body.branches,branchId:body.defaultBranchId,subscription:body.subscription};
 }
 async logout(token:string){await fetch(this.base+'/saas/logout',{method:'POST',headers:{authorization:'Bearer '+token}}).catch(()=>undefined);}
}
