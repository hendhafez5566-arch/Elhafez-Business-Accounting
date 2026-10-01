import assert from 'node:assert/strict';
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

test('the customers full-bleed route renders template classes without the Gemini control skin', () => {
  const html = renderToStaticMarkup(createElement(AppShell, { pathname: '/crm/customers' }));
  assert.match(html, /data-route-surface="full-bleed"/);
  assert.match(html, /class="ct-kpi"/);
  assert.match(html, /class="ct-fab"/);
  assert.doesNotMatch(html, /ui-button/);
  assert.doesNotMatch(html, /ui-input/);
});
