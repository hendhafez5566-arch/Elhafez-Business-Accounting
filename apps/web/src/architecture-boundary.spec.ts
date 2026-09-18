import test from 'node:test';
import assert from 'node:assert/strict';
import { webArchitectureStatus } from './architecture-boundary.js';

test('web remains architecture-only', () => assert.equal(webArchitectureStatus, 'foundation-only'));
