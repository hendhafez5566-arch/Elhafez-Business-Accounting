import test from 'node:test';import assert from 'node:assert/strict';import {LEGACY_ADMIN_COVERAGE,assertLegacyAdminCoverage} from './mc-sa01-legacy-admin-migration.js';
test('legacy administration registry prevents silent omissions',()=>{assert.doesNotThrow(()=>assertLegacyAdminCoverage(LEGACY_ADMIN_COVERAGE.map(x=>x.source)));assert.throws(()=>assertLegacyAdminCoverage(['unknown source']))});
