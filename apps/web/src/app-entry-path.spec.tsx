import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { browserPathname } from './app-entry-path.js';
import { AppShell } from './app-shell.js';

test('shipped app entry pathname still resolves CRM Core routes into the clean rebuild surface', () => {
  const cases = [
    ['/crm/customers', 'crm-customers'],
    ['/crm/agents', 'crm-agents'],
    ['/crm/leads', 'crm-leads'],
    ['/crm/followups', 'crm-followups'],
  ] as const;

  for (const [pathname, routeId] of cases) {
    const html = renderToStaticMarkup(
      createElement(AppShell, { pathname: browserPathname({ pathname }) }),
    );
    assert.match(html, new RegExp(`data-route-id="${routeId}"`));
    assert.match(html, /data-ui-reset="blank"/);
  }
});

test('browser pathname helper falls back to root for an empty pathname', () => {
  assert.equal(browserPathname({ pathname: '' }), '/');
});
