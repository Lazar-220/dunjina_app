import { compareDates, type IsoDate } from '../../domain/dates';
import type { OneOff, Plan } from '../../domain/schema';
import { computeWeek, workoutsBetween, type OverrideIndex } from '../../domain/schedule';
import { oneOffItem, planItem, type CalendarItem } from './calendar-item';

interface CalendarSource {
  plans: readonly Plan[];
  oneOffs: readonly OneOff[];
  index: OverrideIndex;
}

function byDateThenTitle(a: CalendarItem, b: CalendarItem): number {
  if (a.date === b.date) return a.title.localeCompare(b.title);
  if (a.date === null) return 1;
  if (b.date === null) return -1;
  return compareDates(a.date, b.date);
}

/** Every workout dated within [from, to], from all plans (ended plans keep their history) and one-offs. */
export function itemsBetween(source: CalendarSource, from: IsoDate, to: IsoDate): CalendarItem[] {
  const planItems = source.plans.flatMap((plan) =>
    workoutsBetween(plan, from, to, source.index).map((workout) => planItem(plan, workout)),
  );
  const oneOffs = source.oneOffs
    .filter((o) => compareDates(o.date, from) >= 0 && compareDates(o.date, to) <= 0)
    .map(oneOffItem);
  return [...planItems, ...oneOffs].sort(byDateThenTitle);
}

/** Workouts of a plan week that have no day assigned. */
export function unassignedInWeek(plan: Plan, week: number, index: OverrideIndex): CalendarItem[] {
  return computeWeek(plan, week, index)
    .filter((workout) => workout.date === null)
    .map((workout) => planItem(plan, workout));
}

export function groupByDate(items: readonly CalendarItem[]): Map<IsoDate, CalendarItem[]> {
  const groups = new Map<IsoDate, CalendarItem[]>();
  for (const item of items) {
    if (item.date === null) continue;
    groups.set(item.date, [...(groups.get(item.date) ?? []), item]);
  }
  return groups;
}

export function titlesOnDate(items: readonly CalendarItem[], date: IsoDate, excludeKey?: string): string[] {
  return items.filter((item) => item.date === date && item.key !== excludeKey).map((item) => item.title);
}
