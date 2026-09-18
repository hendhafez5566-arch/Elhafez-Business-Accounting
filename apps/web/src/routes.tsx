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
  return routes;
}

export const foundationRoutes = defineRoutes({
  id: 'foundation', path: '/', label: 'الرئيسية', element: 'مساحة العمل جاهزة للوحدات المستقبلية.'
});

export function findRoute(pathname: string, routes: readonly AppRoute[] = foundationRoutes): AppRoute {
  return routes.find((route) => route.path === pathname) ?? routes[0]!;
}
