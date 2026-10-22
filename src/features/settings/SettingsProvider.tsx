import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRepository } from '../../data/RepositoryContext';
import type { Settings } from '../../data/settings';
import { applyTheme } from './theme';

interface SettingsApi {
  settings: Settings;
  update: (changes: Partial<Settings>) => Promise<void>;
}

type Load = { state: 'loading' } | { state: 'failed'; message: string } | { state: 'ready'; settings: Settings };

const SettingsContext = createContext<SettingsApi | null>(null);

/** Loads device settings first: it is the earliest proof that local storage works, and it decides the theme. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const repository = useRepository();
  const [load, setLoad] = useState<Load>({ state: 'loading' });

  useEffect(() => {
    let cancelled = false;
    repository.getSettings().then(
      (settings) => {
        if (!cancelled) setLoad({ state: 'ready', settings });
      },
      (error: unknown) => {
        if (!cancelled) setLoad({ state: 'failed', message: error instanceof Error ? error.message : String(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [repository]);

  const theme = load.state === 'ready' ? load.settings.theme : null;
  useEffect(() => (theme === null ? undefined : applyTheme(theme)), [theme]);

  const update = useCallback(
    async (changes: Partial<Settings>) => {
      if (load.state !== 'ready') return;
      const next = { ...load.settings, ...changes };
      await repository.saveSettings(next);
      setLoad({ state: 'ready', settings: next });
    },
    [load, repository],
  );

  const api = useMemo(() => (load.state === 'ready' ? { settings: load.settings, update } : null), [load, update]);

  if (load.state === 'failed') {
    return (
      <div className="scroll">
        <h1 className="title">Can’t open saved data</h1>
        <div className="banner err" role="alert">
          <span>
            {load.message} If this keeps happening, check that the browser allows site storage and is not in a private
            window.
          </span>
        </div>
      </div>
    );
  }
  if (!api) {
    return (
      <div className="scroll" aria-busy="true" aria-label="Loading">
        <div className="sk" style={{ height: 28, width: '50%' }} />
        <div className="sk" style={{ height: 120 }} />
      </div>
    );
  }
  return <SettingsContext.Provider value={api}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsApi {
  const api = useContext(SettingsContext);
  if (!api) throw new Error('useSettings must be used inside <SettingsProvider>.');
  return api;
}
