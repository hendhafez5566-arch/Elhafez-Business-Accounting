import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ServiceRecoveryActions, summarizeServices } from './tourism-services-page.js';
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

test('tourism service KPI summary derives each status from the real service rows', () => {
  const rows: ServiceRow[] = [
    { id: '1', number: 'S-1', revision: 1, status: 'DRAFT' },
    { id: '2', number: 'S-2', revision: 1, status: 'CONFIRMING' },
    { id: '3', number: 'S-3', revision: 2, status: 'CONFIRMED' },
    { id: '4', number: 'S-4', revision: 1, status: 'CANCELLATION_REQUESTED' },
    { id: '5', number: 'S-5', revision: 1, status: 'CANCELLED' },
    { id: '6', number: 'S-6', revision: 3, status: 'COMPLETED' },
    { id: '7', number: 'S-7', revision: 1, status: 'DRAFT' },
  ];

  assert.deepEqual(summarizeServices(rows), {
    all: 7,
    draft: 2,
    confirming: 1,
    confirmed: 1,
    cancellationRequested: 1,
    cancelled: 1,
    completed: 1,
  });
});
