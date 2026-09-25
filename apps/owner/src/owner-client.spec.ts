import test from 'node:test';
import assert from 'node:assert/strict';
import {OwnerApiClient,amountToMinor} from './owner-client.js';

test('owner client holds the bearer session in process memory and adds it only after login',async()=>{
 const calls:Array<{url:string;headers:Record<string,string>}>=[],fetcher=async(input:RequestInfo|URL,init?:RequestInit)=>{
  const headers=init?.headers as Record<string,string>;calls.push({url:String(input),headers});
  const body=String(input).endsWith('/login')?{token:'session-abc',expiresAt:'2026-01-01',owner:{id:'o',email:'o@example.test'}}:[];
  return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
 };
 const client=new OwnerApiClient('https://api.example.test',fetcher as typeof fetch);
 await client.login('o@example.test','test-value','123456');await client.companies();
 assert.equal(calls[0]!.headers.authorization,undefined);assert.equal(calls[1]!.headers.authorization,'Bearer session-abc');
 assert.equal(JSON.stringify(client).includes('session-abc'),false);
});
test('manual payment amounts are converted to exact integer minor units',()=>{assert.equal(amountToMinor('12800'),1280000);assert.equal(amountToMinor('12800.5'),1280050);assert.throws(()=>amountToMinor('12.345'));});

test('maintenance operations carry fresh MFA and recovery can clear the in-memory owner session',async()=>{
 const calls:Array<{url:string;method:string;headers:Record<string,string>}>=[],fetcher=async(input:RequestInfo|URL,init?:RequestInit)=>{
  const headers=init?.headers as Record<string,string>,url=String(input);calls.push({url,method:init?.method??'GET',headers});
  const body=url.endsWith('/login')?{token:'owner-session',expiresAt:'2026-01-01',owner:{id:'o',email:'o@example.test'}}:url.endsWith('/maintenance')?{active:false}:{active:true};
  return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
 };
 const client=new OwnerApiClient('https://owner.example.test/api',fetcher as typeof fetch);
 await client.login('o@example.test','test-value','123456');await client.enterMaintenance('654321');
 const call=calls.at(-1)!;assert.equal(call.url,'https://owner.example.test/api/saas-owner/operations/maintenance/enter');assert.equal(call.method,'POST');assert.equal(call.headers.authorization,'Bearer owner-session');assert.equal(call.headers['x-owner-totp'],'654321');
 client.clearSession();assert.equal(client.hasSession(),false);
});
