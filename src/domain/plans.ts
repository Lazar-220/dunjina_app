import { compareDates, type IsoDate } from './dates';
import type { Plan } from './schema';

/** A plan is active until the user ends it or its end date has passed. */
export function isPlanActive(plan: Plan, today: IsoDate): boolean {
  if (plan.endedOn !== null) return false;
  return plan.endDate === null || compareDates(plan.endDate, today) >= 0;
}

export function findActivePlan(plans: readonly Plan[], today: IsoDate): Plan | undefined {
  return plans.find((plan) => isPlanActive(plan, today));
}
