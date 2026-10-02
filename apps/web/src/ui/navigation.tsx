import { useState } from 'react';
import type { AppRoute } from '../routes.js';
import { WORKSPACES } from '../workspace-catalog.js';
import { Button } from './primitives.js';
import { Icon } from './icons.js';
import type { SidebarMode } from './preferences.js';

interface NavigationMenuProps {
  readonly routes: readonly AppRoute[];
  readonly activeId: string;
  readonly labelsVisible?: boolean;
  readonly onNavigate?: () => void;
}

export function NavigationMenu({ routes, activeId, labelsVisible = true, onNavigate }: NavigationMenuProps) {
  const items = routes.filter(route => route.navigation !== false);
  return (
    <nav className="app-navigation" aria-label="التنقل الرئيسي">
      {items.map(route => (
        <a
          key={route.id}
          href={route.path}
          aria-current={activeId === route.id ? 'page' : undefined}
          title={!labelsVisible ? route.label : undefined}
          onClick={onNavigate}
        >
          {route.icon ? <Icon name={route.icon} size={20} /> : null}
          {labelsVisible ? <span className="app-navigation__label">{route.label}</span> : null}
        </a>
      ))}
    </nav>
  );
}

export function Sidebar({
  routes,
  activeId,
  mode,
  autoActive,
  onAutoActiveChange,
  onQuickToggle,
  companyLabel,
  branchLabel,
  userLabel,
  subscriptionStatus,
}: {
  readonly routes: readonly AppRoute[];
  readonly activeId: string;
  readonly mode: SidebarMode;
  readonly autoActive: boolean;
  readonly onAutoActiveChange: (active: boolean) => void;
  readonly onQuickToggle: () => void;
  readonly companyLabel?: string;
  readonly branchLabel?: string;
  readonly userLabel?: string;
  readonly subscriptionStatus?: string;
}) {
  const expanded = mode === 'fixed' || (mode === 'auto' && autoActive);
  const labelsVisible = mode !== 'compact' && (mode !== 'auto' || expanded);
  return (
    <aside
      className="app-sidebar"
      data-expanded={expanded ? 'true' : 'false'}
      onMouseEnter={() => mode === 'auto' && onAutoActiveChange(true)}
      onMouseLeave={() => mode === 'auto' && onAutoActiveChange(false)}
    >
      <div className="app-sidebar__brand">
        <a className="app-sidebar__mark" href="/" aria-label="الرئيسية">ح</a>
        {labelsVisible ? <strong className="app-sidebar__brand-text">ELHAFEZ</strong> : null}
        <Button className="app-sidebar__toggle" variant="ghost" type="button" onClick={onQuickToggle} aria-label="تغيير عرض القائمة">
          {expanded ? '‹' : '›'}
        </Button>
      </div>
      <NavigationMenu routes={routes} activeId={activeId} labelsVisible={labelsVisible} />
      {labelsVisible ? (
        <div className="app-sidebar__context" aria-label="بيانات الجلسة">
          {companyLabel ? <strong>{companyLabel}</strong> : null}
          {branchLabel ? <span>{branchLabel}</span> : null}
          {userLabel ? <span>{userLabel}</span> : null}
          {subscriptionStatus ? <small>{subscriptionStatus}</small> : null}
        </div>
      ) : null}
    </aside>
  );
}

export function Topbar({
  routes,
  activeId,
  showMobileMenu = true,
  onOpenMobile,
  companyLabel,
  branchLabel,
  userLabel,
  branches,
  branchId,
  onBranchChange,
  onLogout,
}: {
  readonly routes: readonly AppRoute[];
  readonly activeId: string;
  readonly showMobileMenu?: boolean;
  readonly onOpenMobile: () => void;
  readonly companyLabel?: string;
  readonly branchLabel?: string;
  readonly userLabel?: string;
  readonly branches?: readonly { readonly id: string; readonly name: string }[];
  readonly branchId?: string;
  readonly onBranchChange?: (id: string) => void;
  readonly onLogout?: () => void;
}) {
  const [query, setQuery] = useState('');
  const active = routes.find(route => route.id === activeId) ?? routes[0];
  const matches = query.trim()
    ? routes.filter(route => route.label.includes(query.trim())).slice(0, 8)
    : [];

  return (
    <header className="app-topbar">
      <div className="app-topbar__page">
        {showMobileMenu ? <Button className="mobile-trigger" variant="ghost" type="button" onClick={onOpenMobile} aria-label="فتح القائمة">☰</Button> : null}
        <a className="app-topbar__home" href="/" aria-label="الرئيسية"><Icon name="dashboard" size={18} /><span>الرئيسية</span></a>
        <div className="app-topbar__identity">
          <strong>{active?.label ?? 'الرئيسية'}</strong>
          {companyLabel ? <span>{companyLabel}</span> : null}
        </div>
      </div>

      <div className="app-global-search">
        <label className="sr-only" htmlFor="global-workspace-search">البحث في أقسام النظام</label>
        <input
          id="global-workspace-search"
          className="ui-input"
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="البحث في الأقسام"
          aria-label="البحث في أقسام النظام"
        />
        {matches.length ? (
          <div className="app-global-search__results">
            {matches.map(route => <a key={route.id} href={route.path}>{route.label}</a>)}
          </div>
        ) : null}
      </div>

      <div className="topbar-actions">
        <details className="ui-dropdown">
          <summary aria-label="اختصارات مساحات العمل"><Icon name="dashboard" size={18} /></summary>
          <div className="ui-dropdown__content">
            {WORKSPACES.map(workspace => <a key={workspace.id} href={workspace.landingPath}>{workspace.label}</a>)}
          </div>
        </details>
        {branches?.length && onBranchChange ? (
          <select
            className="topbar-branch"
            aria-label="الفرع الحالي"
            value={branchId ?? ''}
            onChange={event => onBranchChange(event.target.value)}
            title={branchLabel}
          >
            {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        ) : branchLabel ? <span className="topbar-branch-label">{branchLabel}</span> : null}
        <details className="ui-dropdown">
          <summary aria-label="قائمة المستخدم"><Icon name="profile" size={18} /></summary>
          <div className="ui-dropdown__content ui-dropdown__content--user">
            {userLabel ? <strong>{userLabel}</strong> : null}
            {onLogout ? <button type="button" onClick={onLogout}>تسجيل الخروج</button> : null}
          </div>
        </details>
      </div>
    </header>
  );
}
