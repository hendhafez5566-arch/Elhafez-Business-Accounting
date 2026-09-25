export interface OwnerCompany {
 company:{id:string;name:string;active:boolean;createdAt:string};
 companyId:string;companyCode:string|null;mode:'INTERNAL'|'SUBSCRIPTION'|null;
 status:string;allowed:boolean;planId:string|null;currentPeriodEnd:string|null;
 gracePeriodEnd:string|null;entitlements:readonly string[];reason:string|null;
 subscriptionId:string|null;subscriptionVersion:number|null;
}
export interface OwnerPlan {id:string;code:string;name:string;intervalMonths:number;priceMinor:number;currency:string;entitlements:readonly string[];active:boolean;createdAt:string}
type Fetcher=typeof fetch;
type RequestInput={method?:string;body?:unknown;mfaCode?:string;owner?:boolean;bootstrapToken?:string};
export class OwnerApiClient {
 #ownerToken:string|null=null;
 constructor(private readonly baseUrl:string,private readonly fetcher:Fetcher=fetch){}
 hasSession(){return this.#ownerToken!==null}
 private async request<T>(path:string,input:RequestInput={}):Promise<T>{
  const headers:Record<string,string>={'content-type':'application/json'};
  if(input.owner){if(!this.#ownerToken)throw new Error('owner session required');headers.authorization='Bearer '+this.#ownerToken;}
  if(input.mfaCode)headers['x-owner-totp']=input.mfaCode;
  if(input.bootstrapToken)headers['x-saas-bootstrap-token']=input.bootstrapToken;
  const response=await this.fetcher(this.baseUrl+path,{method:input.method??'GET',headers,...(input.body===undefined?{}:{body:JSON.stringify(input.body)})});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){const record=payload as {message?:string;code?:string};throw new Error(record.message??record.code??('HTTP '+response.status));}
  return payload as T;
 }
 async bootstrapOwner(bootstrapToken:string,email:string,password:string){return this.request<{ownerId:string;email:string;mfaSecret:string;otpauthUri:string}>('/saas-owner/bootstrap',{method:'POST',bootstrapToken,body:{email,password}});}
 async login(email:string,password:string,mfaCode:string){const result=await this.request<{token:string;expiresAt:string;owner:{id:string;email:string}}>('/saas-owner/login',{method:'POST',body:{email,password,mfaCode}});this.#ownerToken=result.token;return result;}
 async logout(){try{if(this.#ownerToken)await this.request('/saas-owner/logout',{method:'POST',owner:true});}finally{this.#ownerToken=null;}}
 companies(){return this.request<OwnerCompany[]>('/saas-owner/companies',{owner:true});}
 createCompany(mfaCode:string,input:{name:string;administratorEmail:string;administratorDisplayName:string}){return this.request<{company:{id:string;name:string;active:boolean;createdAt:string;initialBranchId:string};administrator:{id:string;email:string;displayName:string};invitationStatus:'SENT'|'EXISTING_USER'|'DELIVERY_UNAVAILABLE'}>('/saas-owner/companies',{method:'POST',owner:true,mfaCode,body:input});}
 plans(){return this.request<OwnerPlan[]>('/saas-owner/plans',{owner:true});}
 createPlan(mfaCode:string,input:{code:string;name:string;intervalMonths:number;priceMinor:number;currency:string;entitlements:string[]}){return this.request<OwnerPlan>('/saas-owner/plans',{method:'POST',owner:true,mfaCode,body:input});}
 activate(mfaCode:string,companyId:string,input:{planId:string;months:number;paymentReference:string;amountMinor:number;currency:string;idempotencyKey:string}){return this.request('/saas-owner/companies/'+encodeURIComponent(companyId)+'/activate',{method:'POST',owner:true,mfaCode,body:input});}
 renew(mfaCode:string,companyId:string,input:{months:number;paymentReference:string;amountMinor:number;currency:string;idempotencyKey:string}){return this.request('/saas-owner/companies/'+encodeURIComponent(companyId)+'/renew',{method:'POST',owner:true,mfaCode,body:input});}
 suspend(mfaCode:string,companyId:string){return this.request('/saas-owner/companies/'+encodeURIComponent(companyId)+'/suspend',{method:'POST',owner:true,mfaCode});}
 resume(mfaCode:string,companyId:string){return this.request('/saas-owner/companies/'+encodeURIComponent(companyId)+'/resume',{method:'POST',owner:true,mfaCode});}
 cancel(mfaCode:string,companyId:string){return this.request('/saas-owner/companies/'+encodeURIComponent(companyId)+'/cancel',{method:'POST',owner:true,mfaCode});}
 platformSuspend(mfaCode:string,companyId:string){return this.request('/saas-owner/companies/'+encodeURIComponent(companyId)+'/platform-suspend',{method:'POST',owner:true,mfaCode});}
 platformResume(mfaCode:string,companyId:string){return this.request('/saas-owner/companies/'+encodeURIComponent(companyId)+'/platform-resume',{method:'POST',owner:true,mfaCode});}
}
export function amountToMinor(value:string){
 const match=value.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);if(!match)throw new Error('invalid amount');
 const whole=BigInt(match[1]!),fraction=(match[2]??'').padEnd(2,'0');const minor=whole*100n+BigInt(fraction||'0');
 if(minor>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('amount too large');return Number(minor);
}
export function formatMinor(value:number,currency:string){const whole=Math.trunc(value/100),fraction=String(value%100).padStart(2,'0');return whole.toLocaleString('ar-EG')+'.'+fraction+' '+currency;}
