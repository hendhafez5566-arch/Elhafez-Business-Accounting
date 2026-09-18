import assert from 'node:assert/strict';
import test from 'node:test';
import { initialShellState, setMobileDrawer, toggleSidebar } from './shell-state.js';

test('sidebar can collapse and expand without changing other shell state', () => {
  const collapsed = toggleSidebar(initialShellState);
  assert.equal(collapsed.sidebarCollapsed, true);
  assert.equal(collapsed.mobileDrawerOpen, false);
  assert.equal(toggleSidebar(collapsed).sidebarCollapsed, false);
});

test('mobile drawer state is explicit and reversible', () => {
  assert.equal(setMobileDrawer(initialShellState, true).mobileDrawerOpen, true);
  assert.equal(setMobileDrawer(setMobileDrawer(initialShellState, true), false).mobileDrawerOpen, false);
});
