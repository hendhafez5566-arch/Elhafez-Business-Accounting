import test from 'node:test';
import assert from 'node:assert/strict';
import { ModuleNameApplicationService } from './application/module-name.application-service.js';

test('module template is isolated', () => assert.ok(ModuleNameApplicationService));
