import{crmRequest}from'./crm-core-client.js';

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
 private request(method:'GET'|'POST'|'PATCH'|'DELETE',path:string,context:AdministrationContext,body?:unknown){
  return crmRequest<unknown>(`${this.base}/${path}`,{method,body:body===undefined?undefined:JSON.stringify(body)},context);
 }
 async list(path:string,context:AdministrationContext){const body=await this.request('GET',path,context);return Array.isArray(body)?body:body===null||body===undefined?[]:[body];}
 async read(path:string,context:AdministrationContext){return this.request('GET',path,context);}
 async action(path:string,context:AdministrationContext,body:unknown={}){return this.request('POST',path,context,body);}
 async patch(path:string,context:AdministrationContext,body:unknown={}){return this.request('PATCH',path,context,body);}
 async remove(path:string,context:AdministrationContext){return this.request('DELETE',path,context);}
}
