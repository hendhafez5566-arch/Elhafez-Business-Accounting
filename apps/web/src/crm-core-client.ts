export interface CrmApiContext {
  readonly token: string;
  readonly companyId: string;
  readonly branchId: string;
}

function browserContext(): CrmApiContext {
  if (typeof window === 'undefined') return { token: '', companyId: '', branchId: '' };
  return {
    token: window.localStorage.getItem('elhafez.sessionToken') ?? '',
    companyId: window.localStorage.getItem('elhafez.companyId') ?? '',
    branchId: window.localStorage.getItem('elhafez.branchId') ?? '',
  };
}

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
    const body = await response.json().catch(() => ({ message: 'تعذر تنفيذ الطلب.' })) as { message?: string; error?: string };
    throw new CrmApiError(response.status, body.message ?? body.error ?? 'تعذر تنفيذ الطلب.');
  }
  return response.json() as Promise<T>;
}

export const crmGet = <T>(path:string) => crmRequest<T>(path);
export const crmPost = <T>(path:string, body:unknown) => crmRequest<T>(path,{method:'POST',body:JSON.stringify(body)});
export const crmPatch = <T>(path:string, body:unknown) => crmRequest<T>(path,{method:'PATCH',body:JSON.stringify(body)});
export const crmDelete = <T>(path:string) => crmRequest<T>(path,{method:'DELETE'});
