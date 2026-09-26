import assert from 'node:assert/strict';
import test from 'node:test';
import { CurrencyFxModule } from '@elhafez/currency-fx';
import { AppModule } from './app.module.js';
import { AdvancedAccountingController, TourismContractInventoryController } from './frontend-coverage.controller.js';

test('frontend coverage composition registers canonical owner boundaries', () => {
  const controllers = Reflect.getMetadata('controllers', AppModule) as unknown[];
  const imports = Reflect.getMetadata('imports', AppModule) as unknown[];
  assert.ok(controllers.includes(AdvancedAccountingController));
  assert.ok(controllers.includes(TourismContractInventoryController));
  assert.ok(imports.includes(CurrencyFxModule));
});
