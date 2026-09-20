import test from 'node:test';
import assert from 'node:assert/strict';
import { FinancialReportingModule } from '@elhafez/financial-reporting';
import { AppModule } from './app.module.js';

test('AC-13 Financial Reporting is registered through its dependency-free public module boundary', () => {
  const imports = Reflect.getMetadata('imports', AppModule) as readonly unknown[];
  assert.ok(imports.includes(FinancialReportingModule));
});
