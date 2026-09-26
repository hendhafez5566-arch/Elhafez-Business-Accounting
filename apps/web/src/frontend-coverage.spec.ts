import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { findRoute } from './routes.js';
import { TourismContractInventoryPage } from './tourism-contract-inventory-page.js';
import { AssetsFinancingSection, CostBudgetSection, CurrencyFxSection, ExpenseCommissionSection, PartyAccountingSection } from './advanced-accounting-sections.js';

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
