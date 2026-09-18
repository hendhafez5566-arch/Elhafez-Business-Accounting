import test from 'node:test';
import assert from 'node:assert/strict';
import { AppModule } from './app.module.js';

test('composition root is available', () => assert.ok(AppModule));
