import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { browserPathname } from './app-entry-path.js';
import { AppShell } from './app-shell.js';

test('shipped app entry pathname resolves each CRM Core route through the existing shell', () => {
  const cases = [
    ['/crm/customers', '<h1>العملاء</h1>', 'إضافة عميل'],
    ['/crm/agents', '<h1>الوكلاء</h1>', 'إضافة وكيل'],
    ['/crm/leads', '<h1>العملاء المحتملون</h1>', 'إضافة عميل محتمل'],
    ['/crm/followups', '<h1>المتابعات</h1>', 'جدولة متابعة'],
  ] as const;

  for (const [pathname, heading, pageText] of cases) {
    const html = renderToStaticMarkup(
      createElement(AppShell, { pathname: browserPathname({ pathname }) }),
    );
    assert.match(html, new RegExp(heading));
    assert.match(html, new RegExp(pageText));
  }
});

test('browser pathname helper falls back to root for an empty pathname', () => {
  assert.equal(browserPathname({ pathname: '' }), '/');
});
