import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {foundationRoutes} from './routes.js';
import {HttpAdministrationClient} from './system-administration-client.js';

test('Arabic System Administration workspace exposes all approved areas',()=>{const route=foundationRoutes.find(value=>value.id==='system-administration');assert.equal(route?.path,'/system-administration');assert.equal(route?.group,'إدارة النظام');});

test('administration client keeps every mutation scoped and uses the correct HTTP verb',async()=>{
 const calls:Array<{url:string;method:string|undefined;headers:HeadersInit|undefined}>=[];
 const original=globalThis.fetch;
 globalThis.fetch=async(input,init)=>{calls.push({url:String(input),method:init?.method,headers:init?.headers});return new Response(JSON.stringify([]),{status:200,headers:{'content-type':'application/json'}});};
 try{
  const client=new HttpAdministrationClient('/api/system-administration'),context={token:'t',companyId:'c',branchId:'b'};
  await client.list('audit',context);await client.action('sessions/s/revoke',context);await client.patch('branches/b',context,{active:false});await client.remove('files/f',context);await client.read('exports/e/download',context);
  assert.deepEqual(calls.map(call=>call.method),['GET','POST','PATCH','DELETE','GET']);
  for(const call of calls)assert.deepEqual(call.headers,{'authorization':'Bearer t','x-company-id':'c','x-branch-id':'b','content-type':'application/json'});
 }finally{globalThis.fetch=original;}
});

test('administration page contains actionable workflows without browser prompt shortcuts',()=>{
 const source=readFileSync(new URL('./system-administration-page.tsx',import.meta.url),'utf8');
 for(const required of ['إنشاء مستخدم','إعادة تعيين بيانات الدخول','اسم المستخدم','كلمة مرور مؤقتة','إنشاء دور','منح وصول للفرع','إنهاء الجلسة','حفظ إعداد اللغة','رفع ملف الاستيراد','حفظ خريطة الأعمدة','تنفيذ الاستيراد','إنشاء تصدير XLSX','تنزيل التصدير'])assert.match(source,new RegExp(required));
 assert.doesNotMatch(source,/بدء الاستعادة|سياسة الاحتفاظ/);
 assert.doesNotMatch(source,/window\.(prompt|confirm|alert)|\bprompt\(|\bconfirm\(|\balert\(/);
});
