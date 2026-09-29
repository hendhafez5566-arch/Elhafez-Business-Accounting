import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { HistoricalImportApplicationService } from './application/historical-import.application-service.js';
import { PartyCashMovementApplicationService } from './application/party-cash-movement.application-service.js';
import { TreasurySettlementApplicationService } from './application/treasury-settlement.application-service.js';
import { TREASURY_REPOSITORY } from './application/treasury.repository.js';
import { PrismaTreasuryRepository } from './infrastructure/prisma-treasury.repository.js';
import { TreasurySettlementModule } from './treasury-settlement.module.js';

test('production Treasury composition uses Prisma and exports its public application services', () => {
  const providers = Reflect.getMetadata('providers', TreasurySettlementModule) as Array<
    typeof PrismaClient | { provide: unknown; useFactory: (...args: never[]) => unknown }
  >;
  assert.ok(providers.includes(PrismaClient));

  const repository = providers.find(
    (provider) => typeof provider === 'object' && provider.provide === TREASURY_REPOSITORY,
  );
  assert.ok(repository);
  assert.ok(
    (repository as { useFactory: (value: never) => unknown }).useFactory({} as never) instanceof
      PrismaTreasuryRepository,
  );
  assert.ok(
    providers.some(
      (provider) =>
        typeof provider === 'object' && provider.provide === TreasurySettlementApplicationService,
    ),
  );
  assert.ok(
    providers.some(
      (provider) =>
        typeof provider === 'object' && provider.provide === PartyCashMovementApplicationService,
    ),
  );

  const exports = Reflect.getMetadata('exports', TreasurySettlementModule) as unknown[];
  assert.ok(exports.includes(HistoricalImportApplicationService));
  assert.ok(exports.includes(TreasurySettlementApplicationService));
  assert.ok(exports.includes(PartyCashMovementApplicationService));
});
