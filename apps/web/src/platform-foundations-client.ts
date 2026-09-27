import{crmRequest,type CrmApiContext}from'./crm-core-client.js';
export interface PlatformFoundationsClient{
 customFields(context:CrmApiContext):Promise<readonly unknown[]>;
 createCustomField(context:CrmApiContext,input:unknown):Promise<unknown>;
 updateCustomField(context:CrmApiContext,id:string,input:unknown):Promise<unknown>;
 numberingPolicies(context:CrmApiContext):Promise<readonly unknown[]>;
 createNumberingPolicy(context:CrmApiContext,input:unknown):Promise<unknown>;
 updateNumberingPolicy(context:CrmApiContext,id:string,input:unknown):Promise<unknown>;
 workflows(context:CrmApiContext):Promise<readonly unknown[]>;
 createWorkflow(context:CrmApiContext,input:unknown):Promise<unknown>;
 updateWorkflowStatus(context:CrmApiContext,id:string,status:string):Promise<unknown>;
 workflowRuns(context:CrmApiContext):Promise<readonly unknown[]>;
}
export class HttpPlatformFoundationsClient implements PlatformFoundationsClient{
 private get<T>(path:string,context:CrmApiContext){return crmRequest<T>(path,{},context);}
 private post<T>(path:string,context:CrmApiContext,body:unknown){return crmRequest<T>(path,{method:'POST',body:JSON.stringify(body)},context);}
 private patch<T>(path:string,context:CrmApiContext,body:unknown){return crmRequest<T>(path,{method:'PATCH',body:JSON.stringify(body)},context);}
 async customFields(context:CrmApiContext){return this.get<readonly unknown[]>('/custom-fields',context);}
 async createCustomField(context:CrmApiContext,input:unknown){return this.post('/custom-fields',context,input);}
 async updateCustomField(context:CrmApiContext,id:string,input:unknown){return this.patch('/custom-fields/'+encodeURIComponent(id),context,input);}
 async numberingPolicies(context:CrmApiContext){return this.get<readonly unknown[]>('/document-numbering',context);}
 async createNumberingPolicy(context:CrmApiContext,input:unknown){return this.post('/document-numbering',context,input);}
 async updateNumberingPolicy(context:CrmApiContext,id:string,input:unknown){return this.patch('/document-numbering/'+encodeURIComponent(id),context,input);}
 async workflows(context:CrmApiContext){return this.get<readonly unknown[]>('/automation-workflows',context);}
 async createWorkflow(context:CrmApiContext,input:unknown){return this.post('/automation-workflows',context,input);}
 async updateWorkflowStatus(context:CrmApiContext,id:string,status:string){return this.post('/automation-workflows/'+encodeURIComponent(id)+'/status',context,{status});}
 async workflowRuns(context:CrmApiContext){return this.get<readonly unknown[]>('/automation-workflows/runs',context);}
}
