import assert from'node:assert/strict';
import test from'node:test';
import{apiPath,CrmApiError,crmRequest,type CrmApiContext}from'./crm-core-client.js';

const context:CrmApiContext={token:'tenant-token',companyId:'company-1',branchId:'branch-1'};

test('tenant API paths always pass through the canonical /api proxy',()=>{
 assert.equal(apiPath('/crm/customers'),'/api/crm/customers');
 assert.equal(apiPath('/tourism/programs?status=OPEN'),'/api/tourism/programs?status=OPEN');
 assert.equal(apiPath('/api/system-administration/users'),'/api/system-administration/users');
 assert.throws(()=>apiPath('crm/customers'),CrmApiError);
});

test('crmRequest sends tenant context to the canonical API path',async()=>{
 const original=globalThis.fetch;
 let requested='';
 try{
  globalThis.fetch=async(input:RequestInfo|URL,init?:RequestInit)=>{
   requested=String(input);
   const headers=new Headers(init?.headers);
   assert.equal(headers.get('authorization'),'Bearer tenant-token');
   assert.equal(headers.get('x-company-id'),'company-1');
   assert.equal(headers.get('x-branch-id'),'branch-1');
   return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json'}});
  };
  assert.deepEqual(await crmRequest<{ok:boolean}>('/crm/customers',{},context),{ok:true});
  assert.equal(requested,'/api/crm/customers');
 }finally{globalThis.fetch=original;}
});

test('HTML from the web shell is reported as a controlled server response error',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async()=>new Response('<!doctype html><html></html>',{status:200,headers:{'content-type':'text/html'}});
  await assert.rejects(
   crmRequest('/hajj-umrah/seasons',{},context),
   (error:unknown)=>error instanceof CrmApiError&&error.status===502&&error.message==='استجابة غير صالحة من الخادم. حاول مرة أخرى.',
  );
 }finally{globalThis.fetch=original;}
});
