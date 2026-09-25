import test from'node:test';import assert from'node:assert/strict';
import{TENANT_SESSION_KEY,loadTenantSession}from'./auth-session.js';

test('invalid or expired tenant sessions fail closed',()=>{
 const original=globalThis.window;
 const store=new Map<string,string>();
 const storage={getItem:(key:string)=>store.get(key)??null,setItem:(key:string,value:string)=>{store.set(key,value)},removeItem:(key:string)=>{store.delete(key)}} as Storage;
 Object.defineProperty(globalThis,'window',{configurable:true,value:{sessionStorage:storage,localStorage:storage,dispatchEvent:()=>true}});
 try{
  store.set(TENANT_SESSION_KEY,JSON.stringify({token:'t'}));assert.equal(loadTenantSession(),null);
  store.set(TENANT_SESSION_KEY,JSON.stringify({token:'t',userId:'u',expiresAt:'2020-01-01T00:00:00Z',companyId:'c',companyCode:'ELH',companyName:'C',branchId:'b',branchName:'B',subscriptionStatus:'ACTIVE',subscriptionAllowed:true}));
  assert.equal(loadTenantSession(Date.parse('2026-01-01')),null);
 }finally{Object.defineProperty(globalThis,'window',{configurable:true,value:original});}
});
