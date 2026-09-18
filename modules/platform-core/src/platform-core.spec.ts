import assert from 'node:assert/strict';
import test from 'node:test';
import { PlatformCoreApplicationService, PlatformError } from './public/index.js';

test('authentication hashes passwords, resolves context, and revokes sessions', async () => {
  const service = new PlatformCoreApplicationService();
  const user = await service.createUser({ email: 'admin@example.test', password: 'long-safe-password', displayName: 'Admin' });
  assert.notEqual(user.passwordHash, 'long-safe-password');
  const login = await service.login(user.email, 'long-safe-password');
  assert.equal(service.currentUser(login.token).id, user.id);
  service.logout(login.token);
  assert.throws(() => service.currentUser(login.token), PlatformError);
});

test('roles, permissions, company isolation and branch access are enforced', async () => {
  const service = new PlatformCoreApplicationService();
  const user = await service.createUser({ email: 'u@example.test', password: 'long-safe-password', displayName: 'U' });
  const role = service.createRole('administrator'); const permission = service.createPermission('company.manage');
  service.assignRole(user.id, role); service.grantPermission(role, permission); service.authorize(user.id, 'company.manage');
  assert.throws(() => service.authorize(user.id, 'company.delete'), PlatformError);
  const company = service.createCompany(user.id, 'One'); const other = service.createCompany(user.id, 'Two');
  const branch = service.createBranch(user.id, company.id, 'HQ'); service.grantBranchAccess(user.id, branch.id);
  service.requireBranchAccess(user.id, company.id, branch.id);
  assert.throws(() => service.requireBranchAccess(user.id, other.id, branch.id), PlatformError);
});

test('audit, validation, files, notifications and configuration foundations work', async () => {
  const service = new PlatformCoreApplicationService();
  await assert.rejects(service.createUser({ email: 'bad', password: 'short', displayName: '' }), PlatformError);
  const user = await service.createUser({ email: 'a@example.test', password: 'long-safe-password', displayName: 'A' });
  service.registerFile({ companyId: null, key: 'safe/key', contentType: 'text/plain', size: 2, createdBy: user.id });
  assert.equal(service.notify(user.id, 'system.notice', {}).userId, user.id);
  service.setConfiguration('retention.days', 90); assert.equal(service.getConfiguration<number>('retention.days'), 90);
  assert.ok(service.listAudit().length > 0);
  assert.equal(service.toError(new PlatformError('FORBIDDEN', 'x')).status, 403);
});
