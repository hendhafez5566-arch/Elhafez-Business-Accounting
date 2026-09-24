import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_UI_PREFERENCES,
  loadUiPreferences,
  normalizeUiPreferences,
  preferenceStorageKey,
  saveUiPreferences,
  type PreferenceStorage,
} from './preferences.js';

class MemoryStorage implements PreferenceStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

test('UI preferences normalize invalid values to stable defaults', () => {
  assert.deepEqual(
    normalizeUiPreferences({
      sidebarMode: 'unknown',
      fontScale: 'huge',
      fontFamily: 'comic',
      density: 'dense',
    }),
    DEFAULT_UI_PREFERENCES,
  );
});

test('UI preferences persist independently by scope for future authenticated user IDs', () => {
  const storage = new MemoryStorage();
  saveUiPreferences('user-a', {
    sidebarMode: 'auto',
    fontScale: 'large',
    fontFamily: 'system',
    density: 'compact',
  }, storage);
  saveUiPreferences('user-b', {
    sidebarMode: 'fixed',
    fontScale: 'normal',
    fontFamily: 'tahoma',
    density: 'comfortable',
  }, storage);

  assert.equal(loadUiPreferences('user-a', storage).sidebarMode, 'auto');
  assert.equal(loadUiPreferences('user-a', storage).fontScale, 'large');
  assert.equal(loadUiPreferences('user-b', storage).sidebarMode, 'fixed');
  assert.notEqual(preferenceStorageKey('user-a'), preferenceStorageKey('user-b'));
});

test('corrupt stored preferences fail closed to defaults', () => {
  const storage = new MemoryStorage();
  storage.setItem(preferenceStorageKey('user-a'), '{broken');
  assert.deepEqual(loadUiPreferences('user-a', storage), DEFAULT_UI_PREFERENCES);
});
