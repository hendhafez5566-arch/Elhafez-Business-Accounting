import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');
const count = (text: string, needle: string) => text.split(needle).length - 1;

test('Phase 2 Batch A keeps one canonical route owner for each legacy business entry point', () => {
  const routes = source('./routes.tsx');
  const expected = [
    "path: '/crm/leads'",
    "path: '/crm/customers'",
    "path: '/crm/agents'",
    "path: '/crm/quotations'",
    "path: '/tourism/services'",
    "path: '/procurement/suppliers'",
    "path: '/procurement/purchase-orders'",
  ];
  for (const token of expected) assert.equal(count(routes, token), 1, `${token} must have exactly one active owner`);
  assert.match(routes, /element: <LeadsPage\s*\/>/);
  assert.match(routes, /element: <CustomersPage\s*\/>/);
  assert.match(routes, /element: <AgentsPage\s*\/>/);
  assert.match(routes, /element: <QuotationsPage\s*\/>/);
  assert.match(routes, /element: <CrmAwareTourismServicesPage\s*\/>/);
  assert.match(routes, /element: <SuppliersPage\s*\/>/);
  assert.match(routes, /element: <ProcurementOperationsPage\s*\/>/);
});

test('CRM canonical owners retain the legacy-visible lead, customer and agent interactions', () => {
  const leads = source('./crm-lead-followup-parity-pages.tsx');
  const customers = source('./crm-party-pages.tsx');
  const agents = source('./crm-agent-parity-pages.tsx');

  for (const token of ['إضافة عميل محتمل', 'متابعة', 'تحويل إلى عميل', 'مصدر العميل المحتمل', 'الخدمة المطلوبة']) {
    assert.match(leads, new RegExp(token));
  }
  for (const token of ['/crm/customer-documents', '/crm/financial-action', 'الحذف الآمن', 'واتساب']) {
    assert.match(customers, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const token of ['قائمة المندوبين', 'العمولات المستحقة', 'نوع العمولة الافتراضية', 'ملف 360°']) {
    assert.match(agents, new RegExp(token));
  }
});

test('Tourism Services keeps service lifecycle, service-type management and conditional recovery UI', () => {
  const tourism = source('./tourism-services-page.tsx');
  for (const token of [
    'استئناف تأكيد الخدمة',
    'إعادة فحص واستئناف الإلغاء',
    'تمت إضافة نوع الخدمة',
    'سعر الصرف',
    'المورد',
    'العميل',
  ]) assert.match(tourism, new RegExp(token));
  assert.match(tourism, /statusFilter/);
  assert.match(tourism, /sort/);
  assert.match(tourism, /printSnapshot/);
});

test('Procurement and Suppliers keep the legacy-visible supplier and purchase-order controls on canonical contracts', () => {
  const suppliers = source('./supplier-pages.tsx');
  const procurement = source('./procurement-pages.tsx');

  for (const token of ['الرقم الضريبي', 'أيام الائتمان', 'مسؤول التواصل', 'IBAN', 'واتساب', 'موقوف مؤقتًا']) {
    assert.match(suppliers, new RegExp(token));
  }
  for (const token of [
    'أمر شراء جديد',
    'تم اعتماد أمر الشراء',
    'تم تسجيل التنفيذ',
    'تم إنشاء وترحيل فاتورة المورد',
    'مرجع خارجي',
    'التاريخ المتوقع',
  ]) assert.match(procurement, new RegExp(token));
  assert.match(procurement, /\/procurement\/purchase-orders/);
  assert.match(procurement, /\/supplier-invoices/);
});
