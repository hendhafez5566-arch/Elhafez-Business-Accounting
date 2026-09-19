import type { ReactNode } from 'react';

export interface AppRoute {
  readonly id: string;
  readonly path: string;
  readonly label: string;
  readonly group?: string;
  readonly element: ReactNode;
}

/** Public registration seam: future modules contribute route definitions, never shell UI. */
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

export const foundationRoutes = defineRoutes({
  id: 'foundation', path: '/', label: 'الرئيسية', element: 'مساحة العمل جاهزة للوحدات المستقبلية.'
});

export function findRoute(pathname: string, routes: readonly AppRoute[] = foundationRoutes): AppRoute {
  return routes.find((route) => route.path === pathname) ?? routes[0]!;
}
