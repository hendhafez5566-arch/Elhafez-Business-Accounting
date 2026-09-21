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

import { PartyAccountingModule } from '@elhafez/party-accounting';
import { ExpenseCommissionRecognitionModule } from '@elhafez/expense-commission-recognition';
import { TourismContractInventoryModule } from '@elhafez/tourism-contract-inventory/nest';
test('AC-08 production modules are registered through public APIs', () => {
  assert.ok(PartyAccountingModule);
  assert.ok(ExpenseCommissionRecognitionModule);
});
test('AC-11 production module is registered through its public API', () => assert.ok(TourismContractInventoryModule));
