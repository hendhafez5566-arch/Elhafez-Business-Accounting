import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { CrmAwareTourismServicesPage } from './crm-tourism-service-entry-page.js';
import { TourismServicesPage } from './tourism-services-page.js';

const source=(name:string)=>readFileSync(new URL(name,import.meta.url),'utf8');

test('tourism service entry exposes one simple purchase/sale multi-currency flow',()=>{
 const page=source('./tourism-services-page.tsx');
 for(const label of ['عملة البيع','سعر البيع','المورد وسعر الشراء','عملة الشراء','سعر شراء الوحدة','سعر الصرف','الربح المتوقع','تحديث سعر حي'])assert.match(page,new RegExp(label));
 assert.match(page,/advancedAccountingApi\.currencies/);
 assert.match(page,/advancedAccountingApi\.refreshLiveRate/);
 assert.match(page,/customerPartyId/);
});

test('CRM service entry reuses the canonical tourism service page and has no duplicate launcher',()=>{
 const wrapper=source('./crm-tourism-service-entry-page.tsx');
 assert.match(wrapper,/TourismServicesPage/);
 assert.doesNotMatch(wrapper,/CrmNewServiceLauncherPage/);
 assert.equal(existsSync(new URL('./crm-service-launcher-page.tsx',import.meta.url)),false);
});

test('CRM service entry delegates to the canonical tourism page at runtime',()=>{
 const element=CrmAwareTourismServicesPage();
 assert.equal(element.type,TourismServicesPage);
});

test('currency workspace exposes a company currency catalog plus manual and live rates',()=>{
 const page=source('./advanced-accounting-sections.tsx');
 for(const label of ['عملات الشركة','العملات النشطة','إضافة عملة','حفظ سعر يدوي','عرض السعر المسجل','تحديث سعر حي'])assert.match(page,new RegExp(label));
 assert.match(page,/advancedAccountingApi\.currencies/);
 assert.match(page,/advancedAccountingApi\.refreshLiveRate/);
});
