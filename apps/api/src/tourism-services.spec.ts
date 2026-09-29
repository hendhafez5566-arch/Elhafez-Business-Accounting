import test from 'node:test';
import assert from 'node:assert/strict';
import type { PlatformCoreApplicationService } from '@elhafez/platform-core';
import type { StandaloneServicesApplicationService } from '@elhafez/standalone-services';
import type { TourismContractInventoryApplicationService } from '@elhafez/tourism-contract-inventory';
import type { ServiceFulfillmentApplicationService } from '@elhafez/service-fulfillment';
import type { ServiceVouchersApplicationService } from '@elhafez/service-vouchers';
import type { TourismFinanceOrchestrationApplicationService } from '@elhafez/tourism-finance-orchestration';
import { TourismServicesController } from './tourism-services.controller.js';

test('pending cancellation retries with its persisted key and posting date', async () => {
  const calls: Array<{ commandKey: string; postingDate?: string }> = [];
  const platform = {
    currentUser: async () => ({ id: 'actor-1' }),
    requireBranchAccess: async () => undefined,
    authorize: async () => undefined,
  } as unknown as PlatformCoreApplicationService;
  const services = {
    getService: async () => ({ service: { branchId: 'branch-1', status: 'CANCELLATION_REQUESTED', pendingCommandKey: 'original-key', cancellationPostingDate: '2026-09-20' } }),
    requestCancellation: async (input: { commandKey: string; postingDate?: string }, cancel: (input: { commandKey: string; postingDate?: string }) => Promise<unknown>) => {
      calls.push(input);
      await cancel({ ...input, commandKey: `${input.commandKey}:cancel` });
      return { status: 'CANCELLED' };
    },
  } as unknown as StandaloneServicesApplicationService;
  const finance = {
    cancelStandaloneService: async (input: { commandKey: string; postingDate: string }) => {
      calls.push(input);
      return { cancelled: true, blockers: [] };
    },
  } as unknown as TourismFinanceOrchestrationApplicationService;
  const fulfillment = { cancellationBlockers: async () => [] } as unknown as ServiceFulfillmentApplicationService;
  const vouchers = { cancellationBlockers: async () => [] } as unknown as ServiceVouchersApplicationService;
  const controller = new TourismServicesController(
    services,
    {} as TourismContractInventoryApplicationService,
    platform,
    fulfillment,
    vouchers,
    finance,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  await controller.cancel('Bearer token', 'company-1', 'branch-1', 'service-1', { commandKey: 'new-key', postingDate: '2026-09-24' });
  assert.deepEqual(calls, [
    { companyId: 'company-1', branchId: 'branch-1', actorId: 'actor-1', serviceId: 'service-1', commandKey: 'original-key', postingDate: '2026-09-20' },
    { companyId: 'company-1', branchId: 'branch-1', commandKey: 'original-key:cancel', service: { sourceType: 'TOURISM_SERVICE', sourceId: 'service-1' }, postingDate: '2026-09-20', executionCleared: true },
  ]);
});