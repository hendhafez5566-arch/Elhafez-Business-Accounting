import { type ReactNode, useState } from 'react';
import { findRoute, foundationRoutes, type AppRoute } from './routes.js';
import { initialShellState, setMobileDrawer, toggleSidebar } from './shell-state.js';
import { Button, Drawer, Dropdown } from './ui.js';

export function AppShell({ routes = foundationRoutes, pathname = '/', children }: { readonly routes?: readonly AppRoute[]; readonly pathname?: string; readonly children?: ReactNode }) {
  const [state, setState] = useState(initialShellState); const active = findRoute(pathname, routes);
  const navigation = <nav aria-label="التنقل الرئيسي">{routes.map((route) => <a key={route.id} href={route.path} aria-current={active.id === route.id ? 'page' : undefined}>{state.sidebarCollapsed ? route.label.slice(0, 1) : route.label}</a>)}</nav>;
  return <div className={`app-shell ${state.sidebarCollapsed ? 'is-collapsed' : ''}`} dir="rtl">
    <aside className="app-sidebar" aria-label="الشريط الجانبي"><Button aria-label="طي القائمة" onClick={() => setState(toggleSidebar)}>☰</Button>{navigation}</aside>
    <Drawer open={state.mobileDrawerOpen} title="التنقل" onClose={() => setState(setMobileDrawer(state, false))}>{navigation}</Drawer>
    <header className="app-topbar"><Button className="mobile-trigger" aria-label="فتح القائمة" onClick={() => setState(setMobileDrawer(state, true))}>☰</Button><div><strong>الشركة</strong><span> — الفرع</span></div><div className="topbar-actions"><Button aria-label="الإشعارات">🔔</Button><Dropdown label="الحساب"><a href="#account">إعدادات الحساب</a></Dropdown></div></header>
    <main className="app-main"><div className="app-content" tabIndex={-1}><h1>{active.label}</h1>{children ?? active.element}</div></main>
  </div>;
}
