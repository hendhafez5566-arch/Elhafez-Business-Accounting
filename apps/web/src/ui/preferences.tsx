import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export const SIDEBAR_MODES = ['fixed', 'compact', 'auto'] as const;
export const FONT_SCALES = ['small', 'normal', 'large', 'xlarge'] as const;
export const FONT_FAMILIES = ['tahoma', 'system', 'arial'] as const;
export const UI_DENSITIES = ['comfortable', 'balanced', 'compact'] as const;

export type SidebarMode = (typeof SIDEBAR_MODES)[number];
export type FontScale = (typeof FONT_SCALES)[number];
export type FontFamily = (typeof FONT_FAMILIES)[number];
export type UiDensity = (typeof UI_DENSITIES)[number];

export interface UiPreferences {
  readonly sidebarMode: SidebarMode;
  readonly fontScale: FontScale;
  readonly fontFamily: FontFamily;
  readonly density: UiDensity;
}

export const DEFAULT_UI_PREFERENCES: UiPreferences = Object.freeze({
  sidebarMode: 'fixed',
  fontScale: 'normal',
  fontFamily: 'tahoma',
  density: 'comfortable',
});

export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function isOneOf<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === 'string' && values.includes(value as T[number]);
}

export function normalizeUiPreferences(value: unknown): UiPreferences {
  const candidate = value && typeof value === 'object' ? value as Partial<UiPreferences> : {};
  return {
    sidebarMode: isOneOf(SIDEBAR_MODES, candidate.sidebarMode)
      ? candidate.sidebarMode
      : DEFAULT_UI_PREFERENCES.sidebarMode,
    fontScale: isOneOf(FONT_SCALES, candidate.fontScale)
      ? candidate.fontScale
      : DEFAULT_UI_PREFERENCES.fontScale,
    fontFamily: isOneOf(FONT_FAMILIES, candidate.fontFamily)
      ? candidate.fontFamily
      : DEFAULT_UI_PREFERENCES.fontFamily,
    density: isOneOf(UI_DENSITIES, candidate.density)
      ? candidate.density
      : DEFAULT_UI_PREFERENCES.density,
  };
}

export function preferenceStorageKey(scope: string): string {
  return 'elhafez.ui.preferences.v1:' + (scope.trim() || 'default');
}

function browserStorage(): PreferenceStorage | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function loadUiPreferences(
  scope = 'default',
  storage: PreferenceStorage | undefined = browserStorage(),
): UiPreferences {
  if (!storage) return DEFAULT_UI_PREFERENCES;
  try {
    const raw = storage.getItem(preferenceStorageKey(scope));
    return raw ? normalizeUiPreferences(JSON.parse(raw)) : DEFAULT_UI_PREFERENCES;
  } catch {
    return DEFAULT_UI_PREFERENCES;
  }
}

export function saveUiPreferences(
  scope: string,
  preferences: UiPreferences,
  storage: PreferenceStorage | undefined = browserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(preferenceStorageKey(scope), JSON.stringify(normalizeUiPreferences(preferences)));
  } catch {
    // Presentation preferences must never prevent the business application from running.
  }
}

export function applyUiPreferences(preferences: UiPreferences): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.uiFont = preferences.fontFamily;
  root.dataset.uiFontScale = preferences.fontScale;
  root.dataset.uiDensity = preferences.density;
}

interface UiPreferencesContextValue {
  readonly preferences: UiPreferences;
  readonly updatePreferences: (change: Partial<UiPreferences>) => void;
  readonly resetPreferences: () => void;
}

const UiPreferencesContext = createContext<UiPreferencesContextValue | undefined>(undefined);

export function UiPreferencesProvider({
  children,
  scope = 'default',
  initialPreferences,
  storage,
}: {
  readonly children: ReactNode;
  readonly scope?: string;
  readonly initialPreferences?: Partial<UiPreferences>;
  readonly storage?: PreferenceStorage;
}) {
  const resolvedStorage = storage ?? browserStorage();
  const [preferences, setPreferences] = useState<UiPreferences>(() =>
    normalizeUiPreferences({
      ...loadUiPreferences(scope, resolvedStorage),
      ...initialPreferences,
    }),
  );

  useEffect(() => {
    applyUiPreferences(preferences);
    saveUiPreferences(scope, preferences, resolvedStorage);
  }, [preferences, resolvedStorage, scope]);

  const updatePreferences = useCallback((change: Partial<UiPreferences>) => {
    setPreferences((current) => normalizeUiPreferences({ ...current, ...change }));
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_UI_PREFERENCES);
  }, []);

  const value = useMemo(
    () => ({ preferences, updatePreferences, resetPreferences }),
    [preferences, updatePreferences, resetPreferences],
  );

  return <UiPreferencesContext.Provider value={value}>{children}</UiPreferencesContext.Provider>;
}

export function useUiPreferences(): UiPreferencesContextValue {
  const value = useContext(UiPreferencesContext);
  if (!value) throw new Error('useUiPreferences must be used inside UiPreferencesProvider');
  return value;
}
