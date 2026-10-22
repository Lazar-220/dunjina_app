import type { IsoDate } from '../../domain/dates';
import type { OneOff, OneOffDetails, Plan, SlotType } from '../../domain/schema';
import { computeSlotWeek, type OverrideIndex, type Workout, type WorkoutStatus, type WorkoutValues } from '../../domain/schedule';
import { TYPE_META } from '../../shared/workout-types';

/** Points at one workout, either a generated plan instance or a one-off. */
export type ItemRef =
  | { kind: 'plan'; planId: string; slotId: string; week: number }
  | { kind: 'oneOff'; id: string };

/** What the calendar shows for a day: a plan workout or a one-off, in one shape. */
export interface CalendarItem {
  ref: ItemRef;
  key: string;
  type: SlotType;
  title: string;
  date: IsoDate | null;
  status: WorkoutStatus;
  edited: boolean;
  /** Generated values; null for one-offs, which have no plan to compare with. */
  planned: WorkoutValues | null;
  actual: WorkoutValues;
  planName: string | null;
  week: number | null;
}

export function planItem(plan: Plan, workout: Workout): CalendarItem {
  const slot = plan.slots.find((s) => s.id === workout.slotId);
  return {
    ref: { kind: 'plan', planId: plan.id, slotId: workout.slotId, week: workout.week },
    key: `${plan.id}:${workout.id}`,
    type: workout.type,
    title: slot?.label ?? TYPE_META[workout.type].name,
    date: workout.date,
    status: workout.status,
    edited: workout.edited,
    planned: workout.planned,
    actual: workout.actual,
    planName: plan.name,
    week: workout.week,
  };
}

export function oneOffToValues(details: OneOffDetails): WorkoutValues {
  switch (details.kind) {
    case 'strength':
      return {
        kind: 'strength',
        exercises: details.exercises.map((e, position) => ({ exerciseId: String(position), ...e })),
      };
    case 'run':
      return details;
    case 'tempo':
      return details;
    case 'intervals':
      return { ...details, draft: 1, draftCount: 1 };
  }
}

export function valuesToOneOffDetails(values: WorkoutValues): OneOffDetails {
  switch (values.kind) {
    case 'strength':
      return {
        kind: 'strength',
        exercises: values.exercises.map(({ name, sets, reps, kg }) => ({ name, sets, reps, kg })),
      };
    case 'run':
      return values;
    case 'tempo':
      return values;
    case 'intervals': {
      const { count, distanceM, restS, speedKmh, warmupKm, cooldownKm } = values;
      return { kind: 'intervals', count, distanceM, restS, speedKmh, warmupKm, cooldownKm };
    }
  }
}

export function oneOffItem(oneOff: OneOff): CalendarItem {
  const actual = oneOffToValues(oneOff.details);
  return {
    ref: { kind: 'oneOff', id: oneOff.id },
    key: `one-off:${oneOff.id}`,
    type: oneOff.type,
    title: TYPE_META[oneOff.type].name,
    date: oneOff.date,
    status: oneOff.done ? 'done' : 'confirmed',
    edited: false,
    planned: null,
    actual,
    planName: null,
    week: null,
  };
}

interface Source {
  plans: readonly Plan[];
  oneOffs: readonly OneOff[];
  index: OverrideIndex;
}

/** Looks the item up again in current data, so a sheet always shows what is stored now. */
export function resolveItem(source: Source, ref: ItemRef): CalendarItem | null {
  if (ref.kind === 'oneOff') {
    const oneOff = source.oneOffs.find((o) => o.id === ref.id);
    return oneOff ? oneOffItem(oneOff) : null;
  }
  const plan = source.plans.find((p) => p.id === ref.planId);
  const slot = plan?.slots.find((s) => s.id === ref.slotId);
  if (!plan || !slot) return null;
  const workout = computeSlotWeek(plan, slot, ref.week, source.index);
  return workout ? planItem(plan, workout) : null;
}
