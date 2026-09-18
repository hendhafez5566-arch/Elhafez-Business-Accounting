import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { CurrencyFxApplicationService } from './application/currency-fx.application-service.js';
import { CURRENCY_FX_REPOSITORY } from './application/currency-fx.repository.js';
import { CurrencyFxModule } from './currency-fx.module.js';
import { PrismaCurrencyFxRepository } from './infrastructure/prisma-currency-fx.repository.js';

test('production module resolves the public FX service through Prisma persistence', () => {
  const providers = Reflect.getMetadata('providers', CurrencyFxModule) as Array<typeof PrismaClient | { provide: unknown; useFactory: (...args: never[]) => unknown }>;
  assert.ok(providers.includes(PrismaClient));
  const repository = providers.find((provider) => typeof provider === 'object' && provider.provide === CURRENCY_FX_REPOSITORY);
  assert.ok(repository);
  assert.ok((repository as { useFactory: (value: never) => unknown }).useFactory({} as never) instanceof PrismaCurrencyFxRepository);
  assert.ok(providers.some((provider) => typeof provider === 'object' && provider.provide === CurrencyFxApplicationService));
  const exports = Reflect.getMetadata('exports', CurrencyFxModule) as unknown[];
  assert.ok(exports.includes(CurrencyFxApplicationService));
});
