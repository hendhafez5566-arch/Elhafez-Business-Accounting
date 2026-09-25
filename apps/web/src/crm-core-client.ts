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

export async function crmRequest<T>(path: string, init: RequestInit = {}, context: CrmApiContext = browserContext()): Promise<T> {
  if (!context.token || !context.companyId || !context.branchId) throw new CrmApiError(401, 'يلزم تسجيل الدخول واختيار الشركة والفرع.');
  const response = await fetch(path, {
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
    const body = await response.json().catch(() => ({ message: 'تعذر تنفيذ الطلب.' })) as { message?: string; error?: string };
    throw new CrmApiError(response.status, body.message ?? body.error ?? 'تعذر تنفيذ الطلب.');
  }
  return response.json() as Promise<T>;
}

export const crmGet = <T>(path:string) => crmRequest<T>(path);
export const crmPost = <T>(path:string, body:unknown) => crmRequest<T>(path,{method:'POST',body:JSON.stringify(body)});
export const crmPatch = <T>(path:string, body:unknown) => crmRequest<T>(path,{method:'PATCH',body:JSON.stringify(body)});
export const crmDelete = <T>(path:string) => crmRequest<T>(path,{method:'DELETE'});
