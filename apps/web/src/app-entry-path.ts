export interface BrowserLocationLike {
  readonly pathname: string;
}

export function browserPathname(location?: BrowserLocationLike): string {
  const pathname = location?.pathname ?? (typeof window === 'undefined' ? '/' : window.location.pathname);
  return pathname.trim() || '/';
}
