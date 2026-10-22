import { useCallback, useState } from 'react';
import { useRepository } from '../../data/RepositoryContext';
import { mondayOf } from '../../domain/dates';
import { createDemoPlan } from '../../domain/demo-plan';
import { findActivePlan } from '../../domain/plans';
import { newId } from '../../shared/ids';
import { todayIso } from '../../shared/today';
import { useToast } from '../../shared/ui/Toast';
import { usePlanData } from '../plan-data/PlanDataProvider';

type Outcome = { kind: 'none' } | { kind: 'blocked' } | { kind: 'failed'; message: string };

/** Loads the example plan, unless a plan is already active (only one plan can be active at a time). */
export function useDemoPlan(onLoaded: () => void) {
  const repository = useRepository();
  const toast = useToast();
  const planData = usePlanData();
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'none' });

  const loadDemoPlan = useCallback(async () => {
    try {
      const today = todayIso();
      if (findActivePlan(await repository.listPlans(), today)) {
        setOutcome({ kind: 'blocked' });
        return;
      }
      await repository.savePlan(createDemoPlan(mondayOf(today), newId));
      setOutcome({ kind: 'none' });
      toast.show({ message: 'Demo plan loaded' });
      onLoaded();
      await planData.reload();
    } catch (error) {
      setOutcome({ kind: 'failed', message: error instanceof Error ? error.message : String(error) });
    }
  }, [onLoaded, planData, repository, toast]);

  return { outcome, loadDemoPlan };
}
