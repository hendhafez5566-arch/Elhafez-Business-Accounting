import type { IconName } from './ui/icons.js';

export interface RouteDesign {
  readonly blueprint: string;
  readonly reference: string;
}

export interface AppRoute {
  readonly id: string;
  readonly path: string;
  readonly label: string;
  readonly group?: string;
  readonly navigation?: boolean;
  readonly icon?: IconName;
  readonly design: RouteDesign;
}

export function defineRoutes(...routes: readonly AppRoute[]): readonly AppRoute[] {
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const route of routes) {
    if (ids.has(route.id)) throw new Error(`Duplicate route id: ${route.id}`);
    if (paths.has(route.path)) throw new Error(`Duplicate route path: ${route.path}`);
    ids.add(route.id);
    paths.add(route.path);
  }
  return Object.freeze([...routes]);
}

export const foundationRoutes = defineRoutes(
  { id: 'foundation', path: '/', label: 'الرئيسية', group: 'الرئيسية', navigation: true, icon: 'dashboard', design: { blueprint: 'dashboard', reference: 'main-dashboard' } },
  { id: 'hajj-umrah', path: '/hajj-umrah/seasons', label: 'الحج والعمرة', group: 'الحج والعمرة', navigation: true, icon: 'calendar', design: { blueprint: 'workspace', reference: 'hajj-umrah' } },
  { id: 'crm', path: '/crm/dashboard', label: 'المبيعات والعملاء', group: 'المبيعات والعملاء', navigation: true, icon: 'customers', design: { blueprint: 'workspace', reference: 'sales-customers' } },
  { id: 'tourism', path: '/tourism/services', label: 'الخدمات السياحية', group: 'الخدمات السياحية', navigation: true, icon: 'tourism', design: { blueprint: 'workspace', reference: 'tourism-services' } },
  { id: 'procurement', path: '/procurement/suppliers', label: 'المشتريات والموردون', group: 'المشتريات والموردون', navigation: true, icon: 'purchase', design: { blueprint: 'workspace', reference: 'procurement-suppliers' } },
  { id: 'accounting', path: '/accounting', label: 'المحاسبة والمالية', group: 'المحاسبة والمالية', navigation: true, icon: 'analytics', design: { blueprint: 'workspace', reference: 'accounting-finance' } },
  { id: 'reports', path: '/management/dashboard', label: 'التقارير والرقابة', group: 'التقارير والرقابة', navigation: true, icon: 'dashboard', design: { blueprint: 'workspace', reference: 'reports-control' } },
  { id: 'administration', path: '/system-administration', label: 'الإدارة والإعدادات', group: 'الإدارة والإعدادات', navigation: true, icon: 'settings', design: { blueprint: 'workspace', reference: 'administration-settings' } },
);

function normalizePath(pathname: string): string {
  const withoutQuery = pathname.split(/[?#]/, 1)[0] || '/';
  return withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/, '') : '/';
}

export function findRoute(pathname: string, routes: readonly AppRoute[] = foundationRoutes): AppRoute {
  if (!routes.length) throw new Error('At least one route is required.');
  const normalized = normalizePath(pathname);
  return routes.find(route => normalizePath(route.path) === normalized) ?? routes[0]!;
}
