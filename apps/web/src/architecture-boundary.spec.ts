import test from 'node:test';
import assert from 'node:assert/strict';
import { webArchitectureStatus } from './architecture-boundary.js';

test('web owns the generic application shell only', () => assert.equal(webArchitectureStatus, 'application-shell-foundation'));
