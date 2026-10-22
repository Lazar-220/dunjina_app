import { compareDates, dateOfWeekday, type IsoDate, weekIndexOf, weekStartDate } from './dates';
import {
  draftIndexOf,
  finalRunKm,
  finalSpeed,
  finalStrength,
  plannedRunKm,
  plannedSpeed,
  plannedStrength,
  type PartialRepsAndWeight,
  type SpeedConfig,
} from './progression';
import type {
  ExerciseConfig,
  IntervalsSlot,
  Override,
  OverrideValues,
  Plan,
  RunSlot,
  Slot,
  SlotType,
  StrengthSlot,
  TempoSlot,
} from './schema';

// ---------- computed workouts ----------

export interface StrengthExerciseValues {
  exerciseId: string;
  name: string;
  sets: number;
  reps: number;
  kg: number;
}

export type WorkoutValues =
  | { kind: 'strength'; exercises: StrengthExerciseValues[] }
  | { kind: 'run'; km: number }
  | { kind: 'tempo'; km: number; warmupKm: number; cooldownKm: number }
  | {
      kind: 'intervals';
      /** 1-based draft number used this week. */
      draft: number;
      draftCount: number;
      count: number;
      distanceM: number;
      restS: number;
      speedKmh: number;
      warmupKm: number;
      cooldownKm: number;
    };

/** draft: generated, untouched. confirmed: edited or moved, not done. done: logged. */
export type WorkoutStatus = 'draft' | 'confirmed' | 'done';

export interface Workout {
  /** `${slotId}:${week}` */
  id: string;
  planId: string;
  slotId: string;
  type: SlotType;
  week: number;
  /** null: the slot has no weekday and the instance is unassigned. */
  date: IsoDate | null;
  status: WorkoutStatus;
  /** Planned values, as generated from the previous week's final values. */
  planned: WorkoutValues;
  /** Planned values with the user's overrides applied. */
  actual: WorkoutValues;
  /** True when the actual values differ from the planned ones. */
  edited: boolean;
}

// ---------- override lookup ----------

export type OverrideIndex = ReadonlyMap<string, ReadonlyMap<number, Override>>;

export function indexOverrides(overrides: readonly Override[]): OverrideIndex {
  const bySlot = new Map<string, Map<number, Override>>();
  for (const override of overrides) {
    const slotOverrides = bySlot.get(override.slotId) ?? new Map<number, Override>();
    slotOverrides.set(override.week, override);
    bySlot.set(override.slotId, slotOverrides);
  }
  return bySlot;
}

function overrideFor(index: OverrideIndex, slotId: string, week: number): Override | undefined {
  return index.get(slotId)?.get(week);
}

function valuesOfKind<K extends OverrideValues['kind']>(
  override: Override | undefined,
  kind: K,
): Extract<OverrideValues, { kind: K }> | undefined {
  const values = override?.values;
  // The kind check above the cast is what TypeScript cannot express for a generic discriminant.
  return values?.kind === kind ? (values as Extract<OverrideValues, { kind: K }>) : undefined;
}

// ---------- per-type computation ----------

function strengthValues(
  slot: StrengthSlot,
  week: number,
  index: OverrideIndex,
): { planned: WorkoutValues; actual: WorkoutValues } {
  const planned: StrengthExerciseValues[] = [];
  const actual: StrengthExerciseValues[] = [];
  for (const exercise of slot.exercises) {
    const overrideAt = (w: number): PartialRepsAndWeight | undefined =>
      valuesOfKind(overrideFor(index, slot.id, w), 'strength')?.exercises.find((e) => e.exerciseId === exercise.id);
    const sets = valuesOfKind(overrideFor(index, slot.id, week), 'strength')?.exercises.find(
      (e) => e.exerciseId === exercise.id,
    )?.sets;
    planned.push(exerciseValues(exercise, plannedStrength(exercise, week, overrideAt), exercise.sets));
    actual.push(exerciseValues(exercise, finalStrength(exercise, week, overrideAt), sets ?? exercise.sets));
  }
  return { planned: { kind: 'strength', exercises: planned }, actual: { kind: 'strength', exercises: actual } };
}

function exerciseValues(
  exercise: ExerciseConfig,
  value: { reps: number; kg: number },
  sets: number,
): StrengthExerciseValues {
  return { exerciseId: exercise.id, name: exercise.name, sets, reps: value.reps, kg: value.kg };
}

function runValues(
  slot: RunSlot,
  week: number,
  index: OverrideIndex,
): { planned: WorkoutValues; actual: WorkoutValues } {
  const overrideKm = (w: number) => valuesOfKind(overrideFor(index, slot.id, w), 'run')?.km;
  return {
    planned: { kind: 'run', km: plannedRunKm(slot.run, week, overrideKm) },
    actual: { kind: 'run', km: finalRunKm(slot.run, week, overrideKm) },
  };
}

function tempoValues(
  slot: TempoSlot,
  week: number,
  index: OverrideIndex,
): { planned: WorkoutValues; actual: WorkoutValues } {
  const overrideKm = (w: number) => valuesOfKind(overrideFor(index, slot.id, w), 'tempo')?.km;
  const own = valuesOfKind(overrideFor(index, slot.id, week), 'tempo');
  return {
    planned: {
      kind: 'tempo',
      km: plannedRunKm(slot.run, week, overrideKm),
      warmupKm: slot.warmupKm,
      cooldownKm: slot.cooldownKm,
    },
    actual: {
      kind: 'tempo',
      km: finalRunKm(slot.run, week, overrideKm),
      warmupKm: own?.warmupKm ?? slot.warmupKm,
      cooldownKm: own?.cooldownKm ?? slot.cooldownKm,
    },
  };
}

function intervalValues(
  slot: IntervalsSlot,
  week: number,
  index: OverrideIndex,
): { planned: WorkoutValues; actual: WorkoutValues } {
  const speedConfig: SpeedConfig = {
    startSpeedKmh: slot.startSpeedKmh,
    speedStepKmh: slot.speedStepKmh,
    cycleLength: slot.drafts.length,
  };
  const overrideSpeed = (w: number) => valuesOfKind(overrideFor(index, slot.id, w), 'intervals')?.speedKmh;
  const own = valuesOfKind(overrideFor(index, slot.id, week), 'intervals');
  const draftIndex = draftIndexOf(week, slot.drafts.length);
  const draft = slot.drafts[draftIndex];
  if (!draft) throw new RangeError(`Intervals slot ${slot.id} has no drafts.`);
  const base = {
    kind: 'intervals' as const,
    draft: draftIndex + 1,
    draftCount: slot.drafts.length,
    warmupKm: slot.warmupKm,
    cooldownKm: slot.cooldownKm,
  };
  return {
    planned: {
      ...base,
      count: draft.count,
      distanceM: draft.distanceM,
      restS: draft.restS,
      speedKmh: plannedSpeed(speedConfig, week, overrideSpeed),
    },
    actual: {
      ...base,
      count: own?.count ?? draft.count,
      distanceM: own?.distanceM ?? draft.distanceM,
      restS: own?.restS ?? draft.restS,
      speedKmh: finalSpeed(speedConfig, week, overrideSpeed),
      warmupKm: own?.warmupKm ?? slot.warmupKm,
      cooldownKm: own?.cooldownKm ?? slot.cooldownKm,
    },
  };
}

function valuesFor(slot: Slot, week: number, index: OverrideIndex) {
  switch (slot.type) {
    case 'lower':
    case 'upper':
      return strengthValues(slot, week, index);
    case 'easy':
    case 'long':
      return runValues(slot, week, index);
    case 'tempo':
      return tempoValues(slot, week, index);
    case 'intervals':
      return intervalValues(slot, week, index);
  }
}

// ---------- dates and plan bounds ----------

/** Last day with workouts: the earlier of the configured end date and the date the plan was ended. */
export function effectiveEndDate(plan: Plan): IsoDate | null {
  const ends = [plan.endDate, plan.endedOn].filter((d): d is IsoDate => d !== null);
  return ends.length === 0 ? null : ends.reduce((a, b) => (compareDates(a, b) <= 0 ? a : b));
}

/** Last plan week that can hold workouts, or null for an open-ended plan. */
export function lastWeekOf(plan: Plan): number | null {
  const end = effectiveEndDate(plan);
  return end === null ? null : weekIndexOf(plan.startDate, end);
}

function resolveDate(plan: Plan, slot: Slot, week: number, override: Override | undefined): IsoDate | null {
  if (override?.date) return override.date;
  if (slot.defaultWeekday === null) return null;
  const date = dateOfWeekday(plan.startDate, week, slot.defaultWeekday);
  return compareDates(date, plan.startDate) < 0 ? plan.startDate : date;
}

function sameValues(a: WorkoutValues, b: WorkoutValues): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function statusOf(override: Override | undefined): WorkoutStatus {
  if (override?.done) return 'done';
  return override?.values || override?.date ? 'confirmed' : 'draft';
}

// ---------- public API ----------

function isPastEnd(plan: Plan, week: number, date: IsoDate | null): boolean {
  const end = effectiveEndDate(plan);
  if (end === null) return false;
  return compareDates(date ?? weekStartDate(plan.startDate, week), end) > 0;
}

/**
 * One slot's workout in one week, or null when it is deleted or falls outside the plan.
 * A done workout is never cut by the plan end: logged history stays visible.
 */
export function computeSlotWeek(plan: Plan, slot: Slot, week: number, index: OverrideIndex): Workout | null {
  if (week < 1) return null;
  const override = overrideFor(index, slot.id, week);
  if (override?.deleted) return null;

  const date = resolveDate(plan, slot, week, override);
  if (!override?.done && isPastEnd(plan, week, date)) return null;

  const { planned, actual } = valuesFor(slot, week, index);
  return {
    id: `${slot.id}:${week}`,
    planId: plan.id,
    slotId: slot.id,
    type: slot.type,
    week,
    date,
    status: statusOf(override),
    planned,
    actual,
    edited: !sameValues(planned, actual),
  };
}

function compareWorkouts(a: Workout, b: Workout, slotOrder: ReadonlyMap<string, number>): number {
  if (a.date !== b.date) {
    if (a.date === null) return 1;
    if (b.date === null) return -1;
    return compareDates(a.date, b.date);
  }
  return (slotOrder.get(a.slotId) ?? 0) - (slotOrder.get(b.slotId) ?? 0);
}

/** All workouts that belong to plan week `week`, ordered by date (unassigned last). */
export function computeWeek(plan: Plan, week: number, index: OverrideIndex): Workout[] {
  const slotOrder = new Map(plan.slots.map((slot, position) => [slot.id, position]));
  return plan.slots
    .map((slot) => computeSlotWeek(plan, slot, week, index))
    .filter((workout): workout is Workout => workout !== null)
    .sort((a, b) => compareWorkouts(a, b, slotOrder));
}

/**
 * Workouts whose date lies in [from, to]. Includes instances moved into the range from other weeks.
 */
export function workoutsBetween(plan: Plan, from: IsoDate, to: IsoDate, index: OverrideIndex): Workout[] {
  const weeks = new Set<number>();
  const firstWeek = Math.max(1, weekIndexOf(plan.startDate, from));
  const lastWeek = weekIndexOf(plan.startDate, to);
  for (let week = firstWeek; week <= lastWeek; week++) weeks.add(week);
  for (const slot of plan.slots) {
    for (const [week, override] of index.get(slot.id) ?? []) {
      if (override.date && compareDates(override.date, from) >= 0 && compareDates(override.date, to) <= 0) {
        weeks.add(week);
      }
    }
  }
  const slotOrder = new Map(plan.slots.map((slot, position) => [slot.id, position]));
  return [...weeks]
    .flatMap((week) => computeWeek(plan, week, index))
    .filter((w) => w.date !== null && compareDates(w.date, from) >= 0 && compareDates(w.date, to) <= 0)
    .sort((a, b) => compareWorkouts(a, b, slotOrder));
}

/** A copy of `index` where `override` replaces any override for the same slot and week. */
export function withOverride(index: OverrideIndex, override: Override): OverrideIndex {
  const next = new Map<string, ReadonlyMap<number, Override>>(index);
  const slotOverrides = new Map(index.get(override.slotId) ?? []);
  slotOverrides.set(override.week, override);
  next.set(override.slotId, slotOverrides);
  return next;
}

/**
 * Latest date that must stay inside the plan because a done workout sits on it
 * (an unassigned done workout counts as the Monday of its week). Null when nothing is done.
 */
export function lastDoneDate(plan: Plan, index: OverrideIndex): IsoDate | null {
  let latest: IsoDate | null = null;
  for (const slot of plan.slots) {
    for (const [week, override] of index.get(slot.id) ?? []) {
      if (!override.done) continue;
      const workout = computeSlotWeek(plan, slot, week, index);
      if (!workout) continue;
      const date = workout.date ?? weekStartDate(plan.startDate, week);
      if (latest === null || compareDates(date, latest) > 0) latest = date;
    }
  }
  return latest;
}
