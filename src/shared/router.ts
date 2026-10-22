import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'calendar' }
  | { name: 'weeks' }
  | { name: 'plans' }
  | { name: 'settings' }
  /** A new plan; `fromPlanId` starts it as a copy of an existing plan. */
  | { name: 'plan-new'; fromPlanId?: string }
  | { name: 'plan-edit'; planId: string };

/** Tabs of the bottom bar; other routes are full-screen flows without it. */
export type TabRoute = Extract<Route, { name: 'calendar' | 'weeks' | 'plans' | 'settings' }>;

const TAB_PATHS: Record<TabRoute['name'], string> = {
  calendar: '/',
  weeks: '/weeks',
  plans: '/plans',
  settings: '/settings',
};

/** Hash routing keeps the app a plain static site and works unchanged inside a later Capacitor wrapper. */
export function parseRoute(hash: string): Route {
  const [path = '/', query = ''] = hash.replace(/^#/, '').split('?');
  const segments = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query);
  const [first, second, third] = segments;

  if (first === 'weeks') return { name: 'weeks' };
  if (first === 'settings') return { name: 'settings' };
  if (first === 'plans') {
    if (second === 'new') {
      const from = params.get('from');
      return from ? { name: 'plan-new', fromPlanId: from } : { name: 'plan-new' };
    }
    if (second === 'edit' && third) return { name: 'plan-edit', planId: decodeURIComponent(third) };
    return { name: 'plans' };
  }
  return { name: 'calendar' };
}

export function hrefOf(route: Route): string {
  switch (route.name) {
    case 'plan-new':
      return route.fromPlanId ? `#/plans/new?from=${encodeURIComponent(route.fromPlanId)}` : '#/plans/new';
    case 'plan-edit':
      return `#/plans/edit/${encodeURIComponent(route.planId)}`;
    default:
      return `#${TAB_PATHS[route.name]}`;
  }
}

export const isTab = (route: Route): route is TabRoute =>
  route.name === 'calendar' || route.name === 'weeks' || route.name === 'plans' || route.name === 'settings';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

const currentHash = (): string => window.location.hash;

/** The current route. Components compare `route.name`, never raw strings. */
export function useRoute(): Route {
  // useSyncExternalStore compares snapshots by identity, so subscribe to the hash string and parse it per render.
  return parseRoute(useSyncExternalStore(subscribe, currentHash));
}

export function navigate(route: Route): void {
  window.location.hash = hrefOf(route);
}
