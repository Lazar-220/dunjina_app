import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { BackupData } from '../../data/backup';
import { useRepository } from '../../data/RepositoryContext';
import type { OneOff, Override, Plan } from '../../domain/schema';
import { indexOverrides, type OverrideIndex } from '../../domain/schedule';
import { useToast } from '../../shared/ui/Toast';

type Load = { status: 'loading' } | { status: 'failed'; message: string } | { status: 'ready'; data: BackupData };

export interface ReadyPlanData extends BackupData {
  /** Override lookup for the engine. */
  index: OverrideIndex;
}

export type OverrideKey = Pick<Override, 'planId' | 'slotId' | 'week'>;

export interface PlanDataApi {
  load: Load;
  /** Set once storage has been read. */
  ready: ReadyPlanData | null;
  /** Reload everything from storage, e.g. after an import. */
  reload: () => Promise<void>;
  /**
   * Writes resolve to true when saved. On failure the user sees an error toast and the result is false,
   * so callers keep their form open instead of closing it over a lost change.
   */
  saveOverride: (override: Override) => Promise<boolean>;
  removeOverride: (key: OverrideKey) => Promise<boolean>;
  saveOverrides: (overrides: readonly Override[]) => Promise<boolean>;
  removeOverrides: (keys: readonly OverrideKey[]) => Promise<boolean>;
  saveOneOff: (oneOff: OneOff) => Promise<boolean>;
  removeOneOff: (id: string) => Promise<boolean>;
  savePlan: (plan: Plan, dropOverridesOfSlots?: readonly string[]) => Promise<boolean>;
}

const PlanDataContext = createContext<PlanDataApi | null>(null);

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Keeps plans, overrides and one-off workouts in memory and writes every change through the repository.
 * It never blocks its children: a damaged database must not lock the user out of Settings, where a backup can be imported.
 */
export function PlanDataProvider({ children }: { children: ReactNode }) {
  const repository = useRepository();
  const toast = useToast();
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

  const api = useMemo<PlanDataApi>(() => {
    const write = async (operation: () => Promise<void>): Promise<boolean> => {
      try {
        await operation();
      } catch (error) {
        toast.show({ tone: 'error', message: `Couldn’t save your change. Nothing was lost. ${messageOf(error)}` });
        return false;
      }
      await reload();
      return true;
    };
    return {
      load,
      ready,
      reload,
      saveOverride: (override) => write(() => repository.saveOverride(override)),
      removeOverride: ({ planId, slotId, week }) => write(() => repository.removeOverride(planId, slotId, week)),
      saveOverrides: (overrides) => write(() => repository.saveOverrides(overrides)),
      removeOverrides: (keys) => write(() => repository.removeOverrides(keys)),
      saveOneOff: (oneOff) => write(() => repository.saveOneOff(oneOff)),
      removeOneOff: (id) => write(() => repository.removeOneOff(id)),
      savePlan: (plan, dropOverridesOfSlots) => write(() => repository.savePlan(plan, dropOverridesOfSlots)),
    };
  }, [load, ready, reload, repository, toast]);

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
