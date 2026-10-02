import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { browserPathname } from './app-entry-path.js';
import { AppShell } from './app-shell.js';
import { foundationRoutes } from './routes.js';

test('shipped app entry resolves only the seven clean workspace landing paths', () => {
  for (const route of foundationRoutes.slice(1)) {
    const html = renderToStaticMarkup(
      createElement(AppShell, { pathname: browserPathname({ pathname: route.path }) }),
    );
    assert.match(html, new RegExp(`data-route-id="${route.id}"`));
    assert.match(html, /data-ui-reset="blank"/);
  }
});

test('removed legacy paths fall back to the clean portal instead of reviving old UI', () => {
  const html = renderToStaticMarkup(
    createElement(AppShell, { pathname: browserPathname({ pathname: '/crm/customers' }) }),
  );
  assert.match(html, /data-route-id="foundation"/);
  assert.match(html, /class="portal-home"/);
  assert.doesNotMatch(html, /crm-customers/);
});

test('browser pathname helper falls back to root for an empty pathname', () => {
  assert.equal(browserPathname({ pathname: '' }), '/');
});
