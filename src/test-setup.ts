import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// jsdom has no matchMedia; the app only needs it to follow the OS colour scheme.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
});
