import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ServiceRecoveryActions } from './tourism-services-page.js';
import type { ServiceRow, TourismCapabilities } from './tourism-services-client.js';

test('interrupted service operations remain actionable after reopening, under the matching permission', () => {
  const capabilities: TourismCapabilities = { view: true, manage: false, confirm: true, cancel: true, fulfill: false, voucher: false };
  const service: ServiceRow = { id: 'service-1', number: 'S-1', revision: 1, status: 'CONFIRMING' };
  const render = (row: ServiceRow, permissions = capabilities) => renderToStaticMarkup(createElement(ServiceRecoveryActions, { service: row, capabilities: permissions, onConfirm: () => undefined, onCancel: () => undefined }));
  assert.match(render(service), /استئناف تأكيد الخدمة/);
  assert.match(render({ ...service, status: 'CANCELLATION_REQUESTED' }), /استئناف الإلغاء/);
  assert.doesNotMatch(render(service, { ...capabilities, confirm: false }), /استئناف/);
  assert.doesNotMatch(render({ ...service, status: 'CANCELLATION_REQUESTED' }, { ...capabilities, cancel: false }), /استئناف/);
});
