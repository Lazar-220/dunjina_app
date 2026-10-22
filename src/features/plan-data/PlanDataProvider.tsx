import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { BackupData } from '../../data/backup';
import { useRepository } from '../../data/RepositoryContext';
import type { OneOff, Override, Plan } from '../../domain/schema';
import { indexOverrides, type OverrideIndex } from '../../domain/schedule';

type Load = { status: 'loading' } | { status: 'failed'; message: string } | { status: 'ready'; data: BackupData };

export interface ReadyPlanData extends BackupData {
  /** Override lookup for the engine. */
  index: OverrideIndex;
}

export interface PlanDataApi {
  load: Load;
  /** Set once storage has been read. */
  ready: ReadyPlanData | null;
  /** Reload everything from storage, e.g. after an import. */
  reload: () => Promise<void>;
  saveOverride: (override: Override) => Promise<void>;
  removeOverride: (key: Pick<Override, 'planId' | 'slotId' | 'week'>) => Promise<void>;
  saveOneOff: (oneOff: OneOff) => Promise<void>;
  removeOneOff: (id: string) => Promise<void>;
  savePlan: (plan: Plan) => Promise<void>;
}

const PlanDataContext = createContext<PlanDataApi | null>(null);

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Keeps plans, overrides and one-off workouts in memory and writes every change through the repository.
 * It never blocks its children: a damaged database must not lock the user out of Settings, where a backup can be imported.
 */
export function PlanDataProvider({ children }: { children: ReactNode }) {
  const repository = useRepository();
  const [load, setLoad] = useState<Load>({ status: 'loading' });

  const reload = useCallback(async () => {
    try {
      setLoad({ status: 'ready', data: await repository.readAll() });
    } catch (error) {
      setLoad({ status: 'failed', message: messageOf(error) });
    }
  }, [repository]);

  useEffect(() => {
    let cancelled = false;
    repository.readAll().then(
      (data) => {
        if (!cancelled) setLoad({ status: 'ready', data });
      },
      (error: unknown) => {
        if (!cancelled) setLoad({ status: 'failed', message: messageOf(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [repository]);

  const ready = useMemo<ReadyPlanData | null>(
    () => (load.status === 'ready' ? { ...load.data, index: indexOverrides(load.data.overrides) } : null),
    [load],
  );

  const api = useMemo<PlanDataApi>(
    () => ({
      load,
      ready,
      reload,
      saveOverride: async (override) => {
        await repository.saveOverride(override);
        await reload();
      },
      removeOverride: async ({ planId, slotId, week }) => {
        await repository.removeOverride(planId, slotId, week);
        await reload();
      },
      saveOneOff: async (oneOff) => {
        await repository.saveOneOff(oneOff);
        await reload();
      },
      removeOneOff: async (id) => {
        await repository.removeOneOff(id);
        await reload();
      },
      savePlan: async (plan) => {
        await repository.savePlan(plan);
        await reload();
      },
    }),
    [load, ready, reload, repository],
  );

  return <PlanDataContext.Provider value={api}>{children}</PlanDataContext.Provider>;
}

export function usePlanData(): PlanDataApi {
  const api = useContext(PlanDataContext);
  if (!api) throw new Error('usePlanData must be used inside <PlanDataProvider>.');
  return api;
}

/** Renders `children` once storage is read; shows a skeleton while loading and an actionable message on failure. */
export function PlanDataGate({ children }: { children: (data: ReadyPlanData) => ReactNode }) {
  const { load, ready } = usePlanData();
  if (load.status === 'failed') {
    return (
      <div className="scroll">
        <div className="banner err" role="alert">
          <span>{load.message}</span>
        </div>
      </div>
    );
  }
  if (!ready) {
    return (
      <div className="scroll" aria-busy="true" aria-label="Loading">
        <div className="sk" style={{ height: 28, width: '50%' }} />
        <div className="sk" style={{ height: 56, borderRadius: 16 }} />
        <div className="sk" style={{ height: 56, borderRadius: 16 }} />
      </div>
    );
  }
  return <>{children(ready)}</>;
}
