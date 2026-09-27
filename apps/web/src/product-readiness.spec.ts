import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source=(name:string)=>readFileSync(new URL('./'+name,import.meta.url),'utf8');

test('product readiness closure keeps native browser prompts out of commercial workflows',()=>{
 for(const file of ['crm-core-pages.tsx','quotation-pages.tsx','supplier-pages.tsx']){
  assert.doesNotMatch(source(file),/window\.prompt\s*\(/,file);
 }
 assert.match(source('ui/primitives.tsx'),/export function PromptDialog/);
});

test('employee-facing booking flows use named references instead of pasted business ids',()=>{
 const hajjPrimary=source('hajj-umrah-operations-primary-pages.tsx');
 const hajjSecondary=source('hajj-umrah-operations-secondary-pages.tsx');
 const tourism=source('tourism-operations-page.tsx');
 assert.match(hajjPrimary,/loadOperationalReferenceData/);
 assert.match(hajjSecondary,/loadOperationalReferenceData/);
 assert.match(tourism,/loadOperationalReferenceData/);
 assert.doesNotMatch(hajjPrimary,/label="معرّف العميل"/);
 assert.doesNotMatch(hajjPrimary,/label="معرّفات المسافرين"/);
 assert.doesNotMatch(tourism,/label="معرّف العميل"/);
 assert.doesNotMatch(tourism,/افصل المعرفات بفاصلة/);
});

test('Hajj and Umrah program components are edited visually, not as JSON',()=>{
 const programs=source('hajj-umrah-pages.tsx');
 assert.doesNotMatch(programs,/المكونات JSON/);
 assert.match(programs,/إضافة مكون/);
 assert.match(programs,/متطلبات البرنامج/);
});

test('quotation creation exposes the multi-line capability already owned by quotations',()=>{
 const quotations=source('quotation-pages.tsx');
 assert.match(quotations,/draftLines\.map/);
 assert.match(quotations,/إضافة بند/);
 assert.doesNotMatch(quotations,/<style>/);
 assert.match(source('styles.css'),/\.quotation-print/);
});

test('system administration actions select known records rather than requiring pasted user and role ids',()=>{
 const admin=source('system-administration-page.tsx');
 assert.match(admin,/selectRecord\('userId','المستخدم'/);
 assert.match(admin,/selectRecord\('roleId','الدور'/);
 assert.match(admin,/selectRecord\('branchId','الفرع'/);
 assert.match(admin,/DataGrid columns=\{recordKeys/);
});

test('login recovery guidance matches the existing administrator reset model',()=>{
 assert.match(source('tenant-app.tsx'),/تواصل مع مسؤول الشركة لإعادة تعيينها بأمان من إدارة النظام/);
});
