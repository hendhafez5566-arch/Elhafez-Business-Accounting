import { type ReactNode, useState } from 'react';
import { findRoute, foundationRoutes, type AppRoute } from './routes.js';
import { routeSurfaceFor } from './route-surface.js';
import {
  Drawer,
  RoutePresentationBoundary,
  type UiPreferences,
  UiPreferencesProvider,
  useUiPreferences,
} from './ui.js';
import {
  initialShellState,
  setAutoSidebarActive,
  setMobileDrawer,
} from './shell-state.js';
import { NavigationMenu, Sidebar, Topbar } from './ui/navigation.js';

export interface AppShellProps {
  readonly routes?: readonly AppRoute[];
  readonly pathname?: string;
  readonly children?: ReactNode;
  readonly preferenceScope?: string;
  readonly initialPreferences?: Partial<UiPreferences>;
  readonly companyLabel?: string;
  readonly branchLabel?: string;
  readonly userLabel?: string;
  readonly subscriptionStatus?: string;
  readonly branches?: readonly { readonly id: string; readonly name: string }[];
  readonly branchId?: string;
  readonly onBranchChange?: (id: string) => void;
  readonly onLogout?: () => void;
  readonly sessionKey?: string;
}

function BlankInternalWorkspace() {
  return (
    <div
      className="clean-ui-reset-surface"
      data-ui-reset="blank"
      aria-hidden="true"
    />
  );
}

export function AppShell({
  routes = foundationRoutes,
  pathname = '/',
  preferenceScope = 'local-user',
  initialPreferences,
  companyLabel,
  branchLabel,
  userLabel,
  subscriptionStatus,
  branches,
  branchId,
  onBranchChange,
  onLogout,
  sessionKey,
}: AppShellProps) {
  return (
    <UiPreferencesProvider scope={preferenceScope} initialPreferences={initialPreferences}>
      <AppShellFrame
        routes={routes}
        pathname={pathname}
        companyLabel={companyLabel}
        branchLabel={branchLabel}
        userLabel={userLabel}
        subscriptionStatus={subscriptionStatus}
        branches={branches}
        branchId={branchId}
        onBranchChange={onBranchChange}
        onLogout={onLogout}
        sessionKey={sessionKey}
      />
    </UiPreferencesProvider>
  );
}

function AppShellFrame({
  routes,
  pathname,
  companyLabel,
  branchLabel,
  userLabel,
  subscriptionStatus,
  branches,
  branchId,
  onBranchChange,
  onLogout,
  sessionKey,
}: {
  readonly routes: readonly AppRoute[];
  readonly pathname: string;
  readonly companyLabel?: string;
  readonly branchLabel?: string;
  readonly userLabel?: string;
  readonly subscriptionStatus?: string;
  readonly branches?: readonly { readonly id: string; readonly name: string }[];
  readonly branchId?: string;
  readonly onBranchChange?: (id: string) => void;
  readonly onLogout?: () => void;
  readonly sessionKey?: string;
}) {
  const [state, setState] = useState(initialShellState);
  const active = findRoute(pathname, routes);
  const surface = routeSurfaceFor(active.id);
  const { preferences, updatePreferences } = useUiPreferences();
  const sidebarExpanded = preferences.sidebarMode === 'fixed'
    || (preferences.sidebarMode === 'auto' && state.autoSidebarActive);
  const portalHome = active.id === 'foundation';

  function quickToggle() {
    updatePreferences({
      sidebarMode: preferences.sidebarMode === 'fixed' ? 'compact' : 'fixed',
    });
  }

  if (surface === 'full-bleed') {
    return (
      <div
        key={sessionKey}
        className="app-route-surface app-route-surface--full-bleed clean-ui-reset-container"
        dir="rtl"
        data-route-id={active.id}
        data-route-surface="full-bleed"
        data-screen-blueprint={active.design.blueprint}
        data-screen-reference={active.design.reference}
      >
        <RoutePresentationBoundary mode="route-owned">
          <BlankInternalWorkspace />
        </RoutePresentationBoundary>
      </div>
    );
  }

  if (portalHome) {
    return (
      <div
        className="app-shell app-shell--portal"
        dir="rtl"
        data-route-id={active.id}
        data-route-surface="standard"
        data-screen-blueprint={active.design.blueprint}
        data-screen-reference={active.design.reference}
        data-sidebar-mode={preferences.sidebarMode}
        data-sidebar-expanded="false"
      >
        <Topbar
          routes={routes}
          activeId={active.id}
          showMobileMenu={false}
          onOpenMobile={() => undefined}
          companyLabel={companyLabel}
          branchLabel={branchLabel}
          userLabel={userLabel}
          branches={branches}
          branchId={branchId}
          onBranchChange={onBranchChange}
          onLogout={onLogout}
        />
        <main className="app-main app-main--portal app-main--clean-reset">
          <div className="app-content app-content--portal app-content--clean-reset" tabIndex={-1}>
            <BlankInternalWorkspace />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div
      className="app-shell"
      dir="rtl"
      data-route-id={active.id}
      data-route-surface="standard"
      data-screen-blueprint={active.design.blueprint}
      data-screen-reference={active.design.reference}
      data-sidebar-mode={preferences.sidebarMode}
      data-sidebar-expanded={sidebarExpanded ? 'true' : 'false'}
    >
      <Sidebar
        routes={routes}
        activeId={active.id}
        mode={preferences.sidebarMode}
        autoActive={state.autoSidebarActive}
        onAutoActiveChange={activeState => setState(current => setAutoSidebarActive(current, activeState))}
        onQuickToggle={quickToggle}
        companyLabel={companyLabel}
        branchLabel={branchLabel}
        userLabel={userLabel}
        subscriptionStatus={subscriptionStatus}
      />

      <Drawer
        open={state.mobileDrawerOpen}
        title="التنقل"
        onClose={() => setState(current => setMobileDrawer(current, false))}
      >
        <NavigationMenu
          routes={routes}
          activeId={active.id}
          labelsVisible
          onNavigate={() => setState(current => setMobileDrawer(current, false))}
        />
      </Drawer>

      <Topbar
        routes={routes}
        activeId={active.id}
        onOpenMobile={() => setState(current => setMobileDrawer(current, true))}
        companyLabel={companyLabel}
        branchLabel={branchLabel}
        userLabel={userLabel}
        branches={branches}
        branchId={branchId}
        onBranchChange={onBranchChange}
        onLogout={onLogout}
      />

      <main className="app-main app-main--clean-reset">
        <div className="app-content app-content--clean-reset" tabIndex={-1}>
          <BlankInternalWorkspace />
        </div>
      </main>
    </div>
  );
}
