import type { Theme } from '../../data/settings';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Sets data-theme on <html> and, for "system", follows the OS setting. Returns a cleanup function. */
export function applyTheme(theme: Theme): () => void {
  const root = document.documentElement;
  if (theme !== 'system') {
    root.dataset['theme'] = theme;
    return () => undefined;
  }
  const query = window.matchMedia(DARK_QUERY);
  const sync = () => {
    root.dataset['theme'] = query.matches ? 'dark' : 'light';
  };
  sync();
  query.addEventListener('change', sync);
  return () => query.removeEventListener('change', sync);
}
