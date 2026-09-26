import { type ReactNode, useState } from 'react';
import { findRoute, foundationRoutes, type AppRoute } from './routes.js';
import {
  initialShellState,
  setAutoSidebarActive,
  setMobileDrawer,
} from './shell-state.js';
import {
  Drawer,
  PageHeader,
  type UiPreferences,
  UiPreferencesProvider,
  useUiPreferences,
} from './ui.js';
import { NavigationMenu, Sidebar, Topbar } from './ui/navigation.js';

export interface AppShellProps {
  readonly routes?: readonly AppRoute[];
  readonly pathname?: string;
  readonly children?: ReactNode;
  readonly preferenceScope?: string;
  readonly initialPreferences?: Partial<UiPreferences>;
  readonly companyLabel?: string;
  readonly branchLabel?: string;
  readonly branches?: readonly {readonly id:string;readonly name:string}[];
  readonly branchId?: string;
  readonly onBranchChange?: (id:string)=>void;
  readonly onLogout?: ()=>void;
  readonly sessionKey?: string;
}

export function AppShell({
  routes = foundationRoutes,
  pathname = '/',
  children,
  preferenceScope = 'local-user',
  initialPreferences,
  companyLabel,
  branchLabel,
  branches,
  branchId,
  onBranchChange,
  onLogout,
  sessionKey,
}: AppShellProps) {
  return (
    <UiPreferencesProvider scope={preferenceScope} initialPreferences={initialPreferences}>
      <AppShellFrame routes={routes} pathname={pathname} companyLabel={companyLabel} branchLabel={branchLabel} branches={branches} branchId={branchId} onBranchChange={onBranchChange} onLogout={onLogout} sessionKey={sessionKey}>{children}</AppShellFrame>
    </UiPreferencesProvider>
  );
}

function AppShellFrame({
  routes,
  pathname,
  children,
  companyLabel,
  branchLabel,
  branches,
  branchId,
  onBranchChange,
  onLogout,
  sessionKey,
}: {
  readonly routes: readonly AppRoute[];
  readonly pathname: string;
  readonly children?: ReactNode;
  readonly companyLabel?: string;
  readonly branchLabel?: string;
  readonly branches?: readonly {readonly id:string;readonly name:string}[];
  readonly branchId?: string;
  readonly onBranchChange?: (id:string)=>void;
  readonly onLogout?: ()=>void;
  readonly sessionKey?: string;
}) {
  const [state, setState] = useState(initialShellState);
  const active = findRoute(pathname, routes);
  const { preferences, updatePreferences } = useUiPreferences();
  const sidebarExpanded =
    preferences.sidebarMode === 'fixed'
    || (preferences.sidebarMode === 'auto' && state.autoSidebarActive);

  function quickToggle() {
    updatePreferences({
      sidebarMode: preferences.sidebarMode === 'fixed' ? 'compact' : 'fixed',
    });
  }

  return (
    <div
      className="app-shell"
      dir="rtl"
      data-sidebar-mode={preferences.sidebarMode}
      data-sidebar-expanded={sidebarExpanded ? 'true' : 'false'}
    >
      <Sidebar
        routes={routes}
        activeId={active.id}
        mode={preferences.sidebarMode}
        autoActive={state.autoSidebarActive}
        onAutoActiveChange={(activeState) =>
          setState((current) => setAutoSidebarActive(current, activeState))
        }
        onQuickToggle={quickToggle}
      />

      <Drawer
        open={state.mobileDrawerOpen}
        title="التنقل"
        onClose={() => setState((current) => setMobileDrawer(current, false))}
      >
        <NavigationMenu
          routes={routes}
          activeId={active.id}
          labelsVisible
          onNavigate={() => setState((current) => setMobileDrawer(current, false))}
        />
      </Drawer>

      <Topbar onOpenMobile={() => setState((current) => setMobileDrawer(current, true))} companyLabel={companyLabel} branchLabel={branchLabel} branches={branches} branchId={branchId} onBranchChange={onBranchChange} onLogout={onLogout} />

      <main className="app-main">
        <div className="app-content" tabIndex={-1}>
          <PageHeader eyebrow={active.group} title={active.label} />
          <div className="ui-page-stack" key={sessionKey}>{children ?? active.element}</div>
        </div>
      </main>
    </div>
  );
}
