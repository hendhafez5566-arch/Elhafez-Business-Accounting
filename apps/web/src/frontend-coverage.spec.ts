import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { findRoute } from './routes.js';
import { TourismContractInventoryPage } from './tourism-contract-inventory-page.js';
import { AssetsFinancingSection, CostBudgetSection, CurrencyFxSection, ExpenseCommissionSection, PartyAccountingSection } from './advanced-accounting-sections.js';
import { AllowancesSection, RecognitionAccrualSection } from './advanced-accounting-corrective-sections.js';
import { TourismContractInventoryCorrectiveSection } from './tourism-contract-inventory-corrective-section.js';

test('contracts and inventory is a visible tourism workspace', () => {
  const route = findRoute('/tourism/contracts-inventory');
  assert.equal(route.label, 'التعاقدات والمخزون');
  assert.equal(route.group, 'السياحة والخدمات');
  const html = renderToStaticMarkup(createElement(TourismContractInventoryPage));
  assert.match(html, /إنشاء عقد/);
  assert.match(html, /الإتاحة والتخصيص/);
  assert.match(html, /إيقاف البيع/);
});

test('advanced accounting capabilities have real product surfaces', () => {
  const html = [
    CurrencyFxSection,
    CostBudgetSection,
    PartyAccountingSection,
    ExpenseCommissionSection,
    AssetsFinancingSection,
  ].map(component => renderToStaticMarkup(createElement(component))).join('\n');
  assert.match(html, /أسعار الصرف/);
  assert.match(html, /مراكز التكلفة/);
  assert.match(html, /المقاصة الرسمية/);
  assert.match(html, /العمولات/);
  assert.match(html, /الأصول الثابتة/);
  assert.match(html, /القروض والتمويل/);
});


test('shared contract inventory is reachable from Hajj and Umrah without a second owner', () => {
  const route = findRoute('/hajj-umrah/contracts-inventory');
  assert.equal(route.label, 'التعاقدات والمخزون');
  assert.equal(route.group, 'الحج والعمرة');
});

test('corrective frontend coverage exposes owner-backed amendments, recognition, accrual and allowances', () => {
  const inventory = renderToStaticMarkup(createElement(TourismContractInventoryCorrectiveSection, { contractId: 'contract-1' }));
  assert.match(inventory, /تعديل العقد وإصداراته/);
  assert.match(inventory, /مخزون الخدمات العامة/);

  const recognition = renderToStaticMarkup(createElement(RecognitionAccrualSection, { accounts: [], invoices: [] }));
  assert.match(recognition, /الاستحقاق والاعتراف/);
  assert.match(recognition, /الإيرادات المستحقة/);

  const allowances = renderToStaticMarkup(createElement(AllowancesSection, { accounts: [], invoices: [] }));
  assert.match(allowances, /مخصصات الديون المشكوك فيها/);
  assert.match(allowances, /إعدام الرصيد/);
});
