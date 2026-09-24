import assert from 'node:assert/strict';
import test from 'node:test';
import {
  initialShellState,
  setAutoSidebarActive,
  setMobileDrawer,
} from './shell-state.js';

test('automatic sidebar presence is explicit and reversible', () => {
  const active = setAutoSidebarActive(initialShellState, true);
  assert.equal(active.autoSidebarActive, true);
  assert.equal(active.mobileDrawerOpen, false);
  assert.equal(setAutoSidebarActive(active, false).autoSidebarActive, false);
});

test('mobile drawer state is explicit and reversible', () => {
  assert.equal(setMobileDrawer(initialShellState, true).mobileDrawerOpen, true);
  assert.equal(setMobileDrawer(setMobileDrawer(initialShellState, true), false).mobileDrawerOpen, false);
});
