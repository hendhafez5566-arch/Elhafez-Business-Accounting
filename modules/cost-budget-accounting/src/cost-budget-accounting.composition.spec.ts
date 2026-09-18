import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { CostBudgetAccountingApplicationService } from './application/cost-budget-accounting.application-service.js';
import { COST_CENTER_REPOSITORY } from './application/cost-center.repository.js';
import { CostBudgetAccountingModule } from './cost-budget-accounting.module.js';
import { PrismaCostCenterRepository } from './infrastructure/prisma-cost-center.repository.js';

test('production module resolves the public cost service through Prisma persistence', () => {
  const providers = Reflect.getMetadata('providers', CostBudgetAccountingModule) as Array<typeof PrismaClient | { provide: unknown; useFactory: (...args: never[]) => unknown }>;
  assert.ok(providers.includes(PrismaClient));
  const repository = providers.find((provider) => typeof provider === 'object' && provider.provide === COST_CENTER_REPOSITORY);
  assert.ok(repository);
  assert.ok((repository as { useFactory: (value: never) => unknown }).useFactory({} as never) instanceof PrismaCostCenterRepository);
  assert.ok(providers.some((provider) => typeof provider === 'object' && provider.provide === CostBudgetAccountingApplicationService));
  const exports = Reflect.getMetadata('exports', CostBudgetAccountingModule) as unknown[];
  assert.ok(exports.includes(CostBudgetAccountingApplicationService));
});
