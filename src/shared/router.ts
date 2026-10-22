import { useSyncExternalStore } from 'react';

export const ROUTES = ['/', '/weeks', '/plans', '/settings'] as const;
export type Route = (typeof ROUTES)[number];

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

function currentRoute(): Route {
  const path = window.location.hash.replace(/^#/, '') || '/';
  return ROUTES.find((route) => route === path) ?? '/';
}

/** Hash routing keeps the app a plain static site and works unchanged inside a later Capacitor wrapper. */
export function useRoute(): Route {
  return useSyncExternalStore(subscribe, currentRoute);
}

export const hrefOf = (route: Route): string => `#${route}`;
