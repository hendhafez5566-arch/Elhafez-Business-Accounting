import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button, Input, RoutePresentationBoundary } from './ui.js';
import { AppShell } from './app-shell.js';

test('canonical controls keep the shared UI skin outside route-owned presentation', () => {
  const html = renderToStaticMarkup(createElement(Button, { className: 'example' }, 'حفظ'));
  assert.match(html, /ui-button/);
  assert.match(html, /ui-button--primary/);
  assert.match(html, /example/);
});

test('route-owned presentation keeps shared behavior but removes canonical visual classes', () => {
  const content = createElement('div', null,
    createElement(Button, { className: 'ct-btn ct-btn--pri' }, 'حفظ'),
    createElement(Input, { className: 'ct-in', value: 'عميل', readOnly: true }),
  );
  const html = renderToStaticMarkup(
    createElement(RoutePresentationBoundary, { mode: 'route-owned', children: content }),
  );
  assert.match(html, /class="ct-btn ct-btn--pri"/);
  assert.match(html, /class="ct-in"/);
  assert.doesNotMatch(html, /ui-button/);
  assert.doesNotMatch(html, /ui-input/);
});

test('the customers full-bleed route mounts only the clean reset surface', () => {
  const html = renderToStaticMarkup(createElement(AppShell, { pathname: '/crm/customers' }));
  assert.match(html, /data-route-surface="full-bleed"/);
  assert.match(html, /data-ui-reset="blank"/);
  assert.doesNotMatch(html, /class="ct-root"/);
  assert.doesNotMatch(html, /class="ct-kpi"/);
  assert.doesNotMatch(html, /class="ct-fab"/);
  assert.doesNotMatch(html, /ui-button/);
  assert.doesNotMatch(html, /ui-input/);
});

test('route-owned customer CSS contains no force overrides or shell-hiding selectors', () => {
  const css = readFileSync(new URL('./pages/crm-customers/customers.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /!important\b/);
  assert.doesNotMatch(css, /:has\(/);
  assert.doesNotMatch(css, /(?:\.app-shell|\.app-sidebar|\.app-topbar|\.app-main|\.app-content|\.app-route-surface|\.ui-page-stack)/);
});

test('the architecture command includes the replace-not-overlay guard', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')) as { scripts?: Record<string, string> };
  assert.match(packageJson.scripts?.['architecture:check'] ?? '', /check-replace-not-overlay\.ts/);
});
