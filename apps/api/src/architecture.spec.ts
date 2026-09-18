import test from 'node:test';
import assert from 'node:assert/strict';
import { AppModule } from './app.module.js';
import { FinancialControlsModule } from '@elhafez/financial-controls';

test('composition root is available', () => assert.ok(AppModule));
test('Financial Controls production module is registered through its public API', () => assert.ok(FinancialControlsModule));
