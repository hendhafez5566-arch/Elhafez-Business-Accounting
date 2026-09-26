import type { FocusEvent } from 'react';
import type { AppRoute } from '../routes.js';
import { Button, Dropdown } from './primitives.js';
import { Icon } from './icons.js';
import type { SidebarMode } from './preferences.js';

function groupRoutes(routes: readonly AppRoute[]): ReadonlyArray<readonly [string, readonly AppRoute[]]> {
  const groups = new Map<string, AppRoute[]>();
  for (const route of routes) {
    const group = route.group ?? 'عام';
    const list = groups.get(group) ?? [];
    list.push(route);
    groups.set(group, list);
  }
  return [...groups.entries()];
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
  return (
    <nav aria-label="التنقل الرئيسي" className="app-navigation">
      {groupRoutes(routes).map(([group, items]) => {
        const activeGroup = items.some((route) => route.id === activeId);
        const links = items.map((route) => (
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
        ));
        if (!labelsVisible) return <section className="app-navigation__group" key={group}>{links}</section>;
        return (
          <details className="app-navigation__group app-navigation__group--collapsible" key={group} open={activeGroup}>
            <summary className="app-navigation__group-label">
              <span>{group}</span>
              <span className="app-navigation__chevron" aria-hidden="true">⌄</span>
            </summary>
            <div className="app-navigation__items">{links}</div>
          </details>
        );
      })}
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
}: {
  readonly routes: readonly AppRoute[];
  readonly activeId: string;
  readonly mode: SidebarMode;
  readonly autoActive: boolean;
  readonly onAutoActiveChange: (active: boolean) => void;
  readonly onQuickToggle: () => void;
}) {
  const expanded = mode === 'fixed' || (mode === 'auto' && autoActive);

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
        <span className="app-sidebar__mark" aria-hidden="true">E</span>
        {expanded && <span className="app-sidebar__brand-text">ELHAFEZ</span>}
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
    </aside>
  );
}

export function Topbar({
  onOpenMobile,
  companyLabel='الشركة',
  branchLabel='الفرع',
  branches=[],
  branchId='',
  onBranchChange,
  onLogout,
}: {
  readonly onOpenMobile: () => void;
  readonly companyLabel?: string;
  readonly branchLabel?: string;
  readonly branches?: readonly {readonly id:string;readonly name:string}[];
  readonly branchId?: string;
  readonly onBranchChange?: (id:string)=>void;
  readonly onLogout?: ()=>void;
}) {
  return (
    <header className="app-topbar">
      <Button
        variant="ghost"
        className="mobile-trigger"
        aria-label="فتح القائمة"
        onClick={onOpenMobile}
      >
        <Icon name="menu" />
      </Button>
      <div className="app-topbar__identity">
        <strong>{companyLabel}</strong>
        {branches.length>1&&onBranchChange
          ? <label className="app-topbar__branch"><span className="sr-only">الفرع الحالي</span><select value={branchId} onChange={event=>onBranchChange(event.target.value)}>{branches.map(branch=><option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          : <span>{branchLabel}</span>}
      </div>
      <div className="topbar-actions">
        <Button variant="ghost" aria-label="الإشعارات" title="الإشعارات">
          <Icon name="bell" />
        </Button>
        <Dropdown label="الحساب">
          <a href="/settings/appearance">المظهر والتنقل</a>
          <a href="/settings/account">بيانات الدخول</a>
          {onLogout?<Button variant="ghost" type="button" onClick={onLogout}>تسجيل الخروج</Button>:null}
        </Dropdown>
      </div>
    </header>
  );
}
