export interface AdministrationContext{token:string;companyId:string;branchId:string}
export interface AdministrationClient{
 list(path:string,context:AdministrationContext):Promise<readonly unknown[]>;
 read(path:string,context:AdministrationContext):Promise<unknown>;
 action(path:string,context:AdministrationContext,body?:unknown):Promise<unknown>;
 patch(path:string,context:AdministrationContext,body?:unknown):Promise<unknown>;
 remove(path:string,context:AdministrationContext):Promise<unknown>;
}

export class HttpAdministrationClient implements AdministrationClient{
 constructor(private readonly base='/api/system-administration'){}
 private headers(context:AdministrationContext){return{'authorization':`Bearer ${context.token}`,'x-company-id':context.companyId,'x-branch-id':context.branchId,'content-type':'application/json'};}
 private async request(method:'GET'|'POST'|'PATCH'|'DELETE',path:string,context:AdministrationContext,body?:unknown){
  const response=await fetch(`${this.base}/${path}`,{method,headers:this.headers(context),body:body===undefined?undefined:JSON.stringify(body)});
  if(!response.ok)throw new Error(method==='GET'?'تعذر تحميل بيانات إدارة النظام':'تعذر تنفيذ العملية');
  if(response.status===204)return null;
  return response.json() as Promise<unknown>;
 }
 async list(path:string,context:AdministrationContext){const body=await this.request('GET',path,context);return Array.isArray(body)?body:body===null?[]:[body];}
 async read(path:string,context:AdministrationContext){return this.request('GET',path,context);}
 async action(path:string,context:AdministrationContext,body:unknown={}){return this.request('POST',path,context,body);}
 async patch(path:string,context:AdministrationContext,body:unknown={}){return this.request('PATCH',path,context,body);}
 async remove(path:string,context:AdministrationContext){return this.request('DELETE',path,context);}
}
