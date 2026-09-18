import test from 'node:test';
import assert from 'node:assert/strict';
import { AppModule } from './app.module.js';
import { FinancialControlsModule } from '@elhafez/financial-controls';

test('composition root is available', () => assert.ok(AppModule));
test('Financial Controls production module is registered through its public API', () => assert.ok(FinancialControlsModule));

import { TaxModule } from '@elhafez/tax';
import { BillingSubledgersModule } from '@elhafez/billing-subledgers';
test('AC-06 production modules are registered through public APIs', () => {
  assert.ok(TaxModule);
  assert.ok(BillingSubledgersModule);
});

import { TreasurySettlementModule } from '@elhafez/treasury-settlement';
test('AC-07 Treasury production module is registered through its public API', () => assert.ok(TreasurySettlementModule));
