import { addDays, formatDate, mondayOf, weekIndexOf, type IsoDate } from '../../domain/dates';
import { isPlanActive } from '../../domain/plans';
import type { Override, Plan } from '../../domain/schema';
import { effectiveEndDate, lastWeekOf, workoutsBetween, type OverrideIndex } from '../../domain/schedule';
import { weeklyCounts } from '../wizard/wizard-model';

export interface PlanDescription {
  status: 'active' | 'ended';
  /** "Open-ended · since Mon 21 Sep 2026" or "Mon 16 Mar – Sun 14 Jun 2026 · 13 weeks" */
  span: string;
  /** "Now in week 5 · 7 workouts a week" or "52 workouts completed" */
  detail: string;
  strength: number;
  running: number;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

export function describePlan(plan: Plan, today: IsoDate, overrides: readonly Override[]): PlanDescription {
  const status = isPlanActive(plan, today) ? 'active' : 'ended';
  const end = effectiveEndDate(plan);
  const last = lastWeekOf(plan);
  const counts = weeklyCounts(plan.slots);
  const span =
    end === null
      ? `Open-ended · since ${formatDate(plan.startDate)}`
      : `${formatDate(plan.startDate)} – ${formatDate(end)}${last === null ? '' : ` · ${plural(last, 'week')}`}`;
  if (status === 'ended') {
    const completed = overrides.filter((o) => o.planId === plan.id && o.done && !o.deleted).length;
    return { status, span, detail: `${plural(completed, 'workout')} completed`, ...counts };
  }
  const week = weekIndexOf(plan.startDate, today);
  const progress = week >= 1 ? `Now in week ${week}` : `Starts in ${plural(-week + 1, 'week')}`;
  return { status, span, detail: `${progress} · ${plural(plan.slots.length, 'workout')} a week`, ...counts };
}

/** Plans in display order: the active plan first, then the others, newest first. */
export function sortPlans(plans: readonly Plan[], today: IsoDate): Plan[] {
  return [...plans].sort((a, b) => {
    const activeDifference = Number(isPlanActive(b, today)) - Number(isPlanActive(a, today));
    return activeDifference !== 0 ? activeDifference : b.startDate.localeCompare(a.startDate);
  });
}

/** Drafts that disappear this week if the plan ends on `end`: open workouts dated after it up to the end of today's week. */
export function draftsRemovedThisWeek(plan: Plan, index: OverrideIndex, end: IsoDate, today: IsoDate): number {
  const weekEnd = addDays(mondayOf(today), 6);
  const from = addDays(end, 1);
  if (from > weekEnd) return 0;
  return workoutsBetween(plan, from, weekEnd, index).filter((workout) => workout.status !== 'done').length;
}
