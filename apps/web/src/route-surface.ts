export type RouteSurface = 'standard' | 'full-bleed';

const routeSurfaces = Object.freeze({
  'crm-customers': 'full-bleed',
} satisfies Readonly<Record<string, RouteSurface>>);

export function routeSurfaceFor(routeId: string): RouteSurface {
  return routeSurfaces[routeId as keyof typeof routeSurfaces] ?? 'standard';
}

export function declaredRouteSurfaces(): Readonly<Record<string, RouteSurface>> {
  return routeSurfaces;
}
