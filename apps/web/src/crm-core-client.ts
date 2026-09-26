import{clearTenantSession,tenantApiContext}from'./tenant-session.js';
export interface CrmApiContext {
  readonly token: string;
  readonly companyId: string;
  readonly branchId: string;
}

function browserContext():CrmApiContext{return tenantApiContext();}

export class CrmApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); this.name = 'CrmApiError'; }
}

export function apiPath(path:string){
  if(!path.startsWith('/'))throw new CrmApiError(500,'مسار API غير صالح.');
  return path==='/api'||path.startsWith('/api/')||path.startsWith('/api?')?path:'/api'+path;
}

async function responseBody<T>(response:Response):Promise<T>{
  if(response.status===204)return undefined as T;
  const text=await response.text();
  if(!text)return undefined as T;
  const contentType=response.headers.get('content-type')??'';
  if(!contentType.toLowerCase().includes('application/json'))throw new CrmApiError(response.ok?502:response.status,'استجابة غير صالحة من الخادم. حاول مرة أخرى.');
  try{return JSON.parse(text) as T;}catch{throw new CrmApiError(response.ok?502:response.status,'تعذر قراءة استجابة الخادم. حاول مرة أخرى.');}
}

export async function crmRequest<T>(path: string, init: RequestInit = {}, context: CrmApiContext = browserContext()): Promise<T> {
  if (!context.token || !context.companyId || !context.branchId) throw new CrmApiError(401, 'يلزم تسجيل الدخول واختيار الشركة والفرع.');
  const response = await fetch(apiPath(path), {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${context.token}`,
      'x-company-id': context.companyId,
      'x-branch-id': context.branchId,
      ...init.headers,
    },
  });
  if (!response.ok) {
    if(response.status===401)clearTenantSession();
    try{
      const body=await responseBody<{message?:string;error?:string}>(response);
      throw new CrmApiError(response.status,body?.message??body?.error??'تعذر تنفيذ الطلب.');
    }catch(error){
      if(error instanceof CrmApiError)throw error;
      throw new CrmApiError(response.status,'تعذر تنفيذ الطلب.');
    }
  }
  return responseBody<T>(response);
}

export const crmGet = <T>(path:string) => crmRequest<T>(path);
export const crmPost = <T>(path:string, body:unknown) => crmRequest<T>(path,{method:'POST',body:JSON.stringify(body)});
export const crmPatch = <T>(path:string, body:unknown) => crmRequest<T>(path,{method:'PATCH',body:JSON.stringify(body)});
export const crmDelete = <T>(path:string) => crmRequest<T>(path,{method:'DELETE'});
