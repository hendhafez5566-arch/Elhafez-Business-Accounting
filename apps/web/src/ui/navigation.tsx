import {
  type FocusEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { AppRoute } from '../routes.js';
import {
  HttpNotificationCenterClient,
  type NotificationCenterData,
  type NotificationItem,
} from '../notification-center-client.js';
import { tenantApiContext } from '../tenant-session.js';
import { WORKSPACES, workspaceForGroup } from '../workspace-catalog.js';
import { Button, Input, Select } from './primitives.js';
import { Icon } from './icons.js';
import type { SidebarMode } from './preferences.js';

function activeRoute(routes: readonly AppRoute[], activeId: string) {
  return routes.find(route => route.id === activeId);
}

function payloadText(payload: Readonly<Record<string, unknown>>, key: string, fallback: string) {
  const value = payload[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function notificationRoute(item: NotificationItem) {
  const value = item.payload.route;
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/notifications';
}

export function NavigationMenu({
  routes,
  activeId,
  labelsVisible = true,
  onNavigate,
}: {
  readonly routes: readonly AppRoute[];
  readonly activeId: string;
  readonly labelsVisible?: boolean;
  readonly onNavigate?: () => void;
}) {
  const active = activeRoute(routes, activeId);
  const workspace = workspaceForGroup(active?.group);
  const landingRoute = workspace ? routes.find(route => route.path === workspace.landingPath) : undefined;
  const workspaceRoutes = workspace
    ? routes.filter(route => route.navigation !== false && workspace.routeGroups.includes(route.group ?? '') && route.path !== workspace.landingPath)
    : routes.filter(route => route.navigation !== false && route.path !== '/');

  const link = (route: AppRoute) => (
    <a
      key={route.id}
      href={route.path}
      aria-current={activeId === route.id ? 'page' : undefined}
      aria-label={labelsVisible ? undefined : route.label}
      title={labelsVisible ? undefined : route.label}
      onClick={onNavigate}
    >
      <Icon name={route.icon ?? 'program'} />
      {labelsVisible && <span className="app-navigation__label">{route.label}</span>}
    </a>
  );

  return (
    <nav aria-label="التنقل الرئيسي" className="app-navigation">
      <a
        className="app-navigation__portal-link"
        href="/"
        aria-current={activeId === 'foundation' ? 'page' : undefined}
        aria-label={labelsVisible ? undefined : 'الصفحة الرئيسية'}
        title={labelsVisible ? undefined : 'الصفحة الرئيسية'}
        onClick={onNavigate}
      >
        <Icon name="home" />
        {labelsVisible && (
          <span className="app-navigation__portal-copy">
            <strong>الصفحة الرئيسية</strong>
            <small>مساحات العمل</small>
          </span>
        )}
      </a>

      {workspace && labelsVisible ? <div className="app-navigation__section-label">{workspace.label}</div> : null}

      {landingRoute ? (
        <a
          className="app-navigation__landing"
          href={landingRoute.path}
          aria-current={activeId === landingRoute.id ? 'page' : undefined}
          aria-label={labelsVisible ? undefined : 'واجهة القسم'}
          title={labelsVisible ? undefined : 'واجهة القسم'}
          onClick={onNavigate}
        >
          <Icon name={workspace?.icon ?? landingRoute.icon ?? 'workspace'} />
          {labelsVisible && <span className="app-navigation__label">واجهة القسم</span>}
        </a>
      ) : null}

      <div className="app-navigation__items">
        {workspaceRoutes.map(link)}
      </div>
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
  companyLabel = 'اسم الشركة',
  branchLabel = 'الفرع',
  userLabel = 'المستخدم',
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
  const companyInitial = companyLabel.trim().charAt(0) || 'ح';
  const userInitial = userLabel.trim().charAt(0) || 'م';

  function blur(event: FocusEvent<HTMLElement>) {
    if (mode !== 'auto') return;
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onAutoActiveChange(false);
  }

  return (
    <aside
      className="app-sidebar"
      aria-label="الشريط الجانبي"
      data-expanded={expanded ? 'true' : 'false'}
      onMouseEnter={() => mode === 'auto' && onAutoActiveChange(true)}
      onMouseLeave={() => mode === 'auto' && onAutoActiveChange(false)}
      onFocusCapture={() => mode === 'auto' && onAutoActiveChange(true)}
      onBlurCapture={blur}
    >
      <div className="app-sidebar__brand">
        <span className="app-sidebar__mark" aria-hidden="true">{companyInitial}</span>
        {expanded && (
          <span className="app-sidebar__brand-text">
            <strong>{companyLabel}</strong>
            <small>نظام السياحة والحج والعمرة</small>
            <em>Elhafez Technology</em>
          </span>
        )}
        <Button
          variant="ghost"
          className="app-sidebar__toggle"
          aria-label={mode === 'fixed' ? 'تصغير القائمة' : 'تثبيت القائمة'}
          title={mode === 'fixed' ? 'تصغير القائمة' : 'تثبيت القائمة'}
          onClick={onQuickToggle}
        >
          <Icon name="menu" />
        </Button>
      </div>

      <NavigationMenu routes={routes} activeId={activeId} labelsVisible={expanded} />

      <footer className="app-sidebar__footer">
        <div className="app-sidebar__account">
          <span className="app-sidebar__user-mark" aria-hidden="true">{userInitial}</span>
          {expanded && (
            <span>
              <strong>{userLabel}</strong>
              <small>{branchLabel}</small>
            </span>
          )}
        </div>
        {expanded && (
          <div className="app-sidebar__license">
            <span>ELHAFEZ Business Platform</span>
            {subscriptionStatus ? <small>حالة الترخيص: {subscriptionStatus}</small> : null}
          </div>
        )}
      </footer>
    </aside>
  );
}

export function Topbar({
  routes,
  activeId,
  onOpenMobile,
  showMobileMenu = true,
  companyLabel = 'الشركة',
  branchLabel = 'الفرع',
  userLabel = 'المستخدم',
  branches = [],
  branchId = '',
  onBranchChange,
  onLogout,
}: {
  readonly routes: readonly AppRoute[];
  readonly activeId: string;
  readonly onOpenMobile: () => void;
  readonly showMobileMenu?: boolean;
  readonly companyLabel?: string;
  readonly branchLabel?: string;
  readonly userLabel?: string;
  readonly branches?: readonly { readonly id: string; readonly name: string }[];
  readonly branchId?: string;
  readonly onBranchChange?: (id: string) => void;
  readonly onLogout?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationCenterData | null>(null);
  const [notificationError, setNotificationError] = useState('');
  const searchableRoutes = useMemo(
    () => routes.filter(route => route.navigation !== false && route.path !== '/'),
    [routes],
  );
  const current = activeRoute(routes, activeId) ?? routes[0];
  const workspace = workspaceForGroup(current?.group);
  const normalizedQuery = query.trim().toLocaleLowerCase('ar');
  const matches = useMemo(
    () => normalizedQuery
      ? searchableRoutes.filter(route => `${route.label} ${route.group ?? ''}`.toLocaleLowerCase('ar').includes(normalizedQuery)).slice(0, 8)
      : [],
    [normalizedQuery, searchableRoutes],
  );

  useEffect(() => {
    const context = tenantApiContext();
    if (!context.token) return;
    let cancelled = false;
    setNotificationError('');
    const client = new HttpNotificationCenterClient();
    void client.list(context).then(data => {
      if (!cancelled) setNotifications(data);
    }).catch(error => {
      if (!cancelled) setNotificationError(error instanceof Error ? error.message : 'تعذر تحميل الإشعارات.');
    });
    return () => { cancelled = true; };
  }, [branchId]);

  function navigateFromSearch(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setSearchOpen(false);
      return;
    }
    if (event.key !== 'Enter' || !matches[0]) return;
    window.location.href = matches[0].path;
  }

  function searchBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setSearchOpen(false);
  }

  return (
    <header className="app-topbar">
      <div className="app-topbar__page">
        {showMobileMenu ? (
          <Button
            variant="ghost"
            className="mobile-trigger"
            aria-label="فتح القائمة"
            onClick={onOpenMobile}
          >
            <Icon name="menu" />
          </Button>
        ) : null}
        <span>
          <strong>{current?.label ?? 'الصفحة الرئيسية'}</strong>
          <small>{activeId === 'foundation' ? 'اختر مساحة العمل المطلوبة' : workspace?.label ?? current?.group ?? companyLabel}</small>
        </span>
      </div>

      <div
        className="app-global-search"
        aria-label="البحث العام"
        onFocusCapture={() => setSearchOpen(true)}
        onBlurCapture={searchBlur}
      >
        <Icon name="search" size={18} />
        <Input
          type="search"
          aria-label="البحث في أقسام النظام"
          placeholder="ابحث عن شاشة أو قسم..."
          value={query}
          onChange={event => { setQuery(event.target.value); setSearchOpen(true); }}
          onKeyDown={navigateFromSearch}
        />
        {searchOpen && normalizedQuery ? (
          <div className="app-global-search__results" role="listbox" aria-label="نتائج البحث">
            {matches.length ? matches.map(route => (
              <a key={route.id} href={route.path} role="option">
                <Icon name={route.icon ?? 'program'} size={17} />
                <span><strong>{route.label}</strong><small>{route.group}</small></span>
              </a>
            )) : <p>لا توجد شاشة مطابقة.</p>}
          </div>
        ) : null}
      </div>

      <div className="topbar-actions">
        <div className="app-topbar__branch-wrap">
          {branches.length > 1 && onBranchChange ? (
            <label className="app-topbar__branch">
              <span className="sr-only">الفرع الحالي</span>
              <Select value={branchId} onChange={event => onBranchChange(event.target.value)} aria-label="الفرع الحالي">
                {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </Select>
            </label>
          ) : <span className="app-topbar__branch-static">{branchLabel}</span>}
        </div>

        <a className="app-topbar__home" href="/" aria-label="الصفحة الرئيسية"><Icon name="home" size={17} /><span>الصفحة الرئيسية</span></a>
        <Button variant="ghost" className="app-topbar__text-action" type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>↑ لأعلى</Button>
        <Button variant="ghost" className="app-topbar__text-action" type="button" onClick={() => window.history.back()}>← رجوع</Button>

        <details className="ui-dropdown app-topbar-menu app-topbar-menu--shortcuts">
          <summary aria-label="اختصارات مساحات العمل" title="اختصارات مساحات العمل"><Icon name="workspace" /></summary>
          <div className="ui-dropdown__content">
            <strong className="app-topbar-menu__title">مساحات العمل</strong>
            {WORKSPACES.map(item => <a href={item.landingPath} key={item.id}><Icon name={item.icon} size={16} />{item.label}</a>)}
          </div>
        </details>

        <details className="ui-dropdown app-topbar-menu app-topbar-menu--notifications">
          <summary aria-label="الإشعارات" title="الإشعارات">
            <Icon name="bell" />
            {notifications?.unreadCount ? <span className="app-topbar__notification-count">{notifications.unreadCount}</span> : null}
          </summary>
          <div className="ui-dropdown__content">
            <strong className="app-topbar-menu__title">الإشعارات</strong>
            {notificationError ? <p className="app-topbar-menu__message">{notificationError}</p> : null}
            {!notifications && !notificationError ? <p className="app-topbar-menu__message">جارٍ تحميل الإشعارات…</p> : null}
            {notifications?.items.length === 0 ? <p className="app-topbar-menu__message">لا توجد إشعارات حاليًا.</p> : null}
            {notifications?.items.slice(0, 4).map(item => (
              <a className="app-notification-preview" href={notificationRoute(item)} key={item.id}>
                <span className={item.readAt ? 'is-read' : 'is-unread'} aria-hidden="true" />
                <span>
                  <strong>{payloadText(item.payload, 'title', 'إشعار')}</strong>
                  <small>{payloadText(item.payload, 'message', item.type)}</small>
                </span>
              </a>
            ))}
            <a className="app-topbar-menu__all" href="/notifications">فتح مركز الإشعارات</a>
          </div>
        </details>

        <details className="ui-dropdown app-topbar-menu app-topbar-menu--user">
          <summary aria-label="قائمة المستخدم" title="قائمة المستخدم">
            <span className="app-topbar__avatar" aria-hidden="true">{userLabel.trim().charAt(0) || 'م'}</span>
          </summary>
          <div className="ui-dropdown__content">
            <span className="app-user-menu__identity"><strong>{userLabel}</strong><small>{companyLabel} · {branchLabel}</small></span>
            <a href="/settings/account">بيانات الدخول</a>
            <a href="/settings/appearance">المظهر والتنقل</a>
            {onLogout ? <Button variant="ghost" type="button" onClick={onLogout}>تسجيل الخروج</Button> : null}
          </div>
        </details>
      </div>
    </header>
  );
}
