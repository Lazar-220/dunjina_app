import { addDays, formatDayShort, weekStartDate, type IsoDate } from '../../domain/dates';
import { runningKm } from '../../domain/metrics';
import type { Override, Plan, Slot } from '../../domain/schema';
import {
  computeSlotWeek,
  computeWeek,
  indexOverrides,
  type OverrideIndex,
  type Workout,
  type WorkoutValues,
} from '../../domain/schedule';
import { describeValues, fmt, fmtSpeed } from '../workout/describe';

export interface WeekSummary {
  week: number;
  start: IsoDate;
  end: IsoDate;
  workouts: Workout[];
  done: Workout[];
  open: Workout[];
  runningKm: number;
  /** Not-done overrides of this week (edited, moved or deleted): what "Reset week" removes. */
  resettable: Pick<Override, 'planId' | 'slotId' | 'week'>[];
  statusLine: string;
}

const EMPTY_INDEX: OverrideIndex = indexOverrides([]);

export function summarizeWeek(plan: Plan, week: number, index: OverrideIndex, overrides: readonly Override[]): WeekSummary {
  const start = weekStartDate(plan.startDate, week);
  const workouts = computeWeek(plan, week, index);
  const done = workouts.filter((w) => w.status === 'done');
  const edited = workouts.filter((w) => w.edited || w.status === 'confirmed').length;
  const slotIds = new Set(plan.slots.map((s) => s.id));
  const resettable = overrides
    .filter((o) => o.planId === plan.id && o.week === week && slotIds.has(o.slotId) && !o.done)
    .map(({ planId, slotId, week: w }) => ({ planId, slotId, week: w }));
  const progress = done.length > 0 ? `${done.length} of ${workouts.length} done` : `${workouts.length} workouts`;
  return {
    week,
    start,
    end: addDays(start, 6),
    workouts,
    done,
    open: workouts.filter((w) => w.status !== 'done'),
    runningKm: workouts.reduce((sum, w) => sum + runningKm(w.actual), 0),
    resettable,
    statusLine: edited > 0 ? `${progress} · ${edited} edited` : progress,
  };
}

/** "21 Sep – 27 Sep" */
export function rangeLabel(start: IsoDate, end: IsoDate): string {
  const short = (date: IsoDate) => formatDayShort(date).slice(4);
  return `${short(start)} – ${short(end)}`;
}

function slotAt(plan: Plan, slot: Slot, week: number, index: OverrideIndex): Workout | null {
  return computeSlotWeek(plan, slot, week, index);
}

/** Short badge for what happens in this week: a reset, a maximum, a weight step or a speed step. */
export function progressionTag(plan: Plan, slot: Slot, workout: Workout, index: OverrideIndex): string {
  const previous = slotAt(plan, slot, workout.week - 1, index)?.actual;
  const current = workout.actual;
  if (slot.type === 'easy' || slot.type === 'long' || slot.type === 'tempo') {
    const km = current.kind === 'run' || current.kind === 'tempo' ? current.km : 0;
    const previousKm = previous && (previous.kind === 'run' || previous.kind === 'tempo') ? previous.km : undefined;
    if (previousKm !== undefined && previousKm >= slot.run.max) return 'Reset';
    return km === slot.run.max ? 'Max' : '';
  }
  if (current.kind === 'strength' && previous?.kind === 'strength') {
    const stepped = current.exercises.some((e) => e.kg > (previous.exercises.find((p) => p.exerciseId === e.exerciseId)?.kg ?? e.kg));
    return stepped ? 'Weight step' : '';
  }
  if (current.kind === 'intervals' && previous?.kind === 'intervals' && current.speedKmh > previous.speedKmh) {
    return `Speed +${fmt(current.speedKmh - previous.speedKmh)}`;
  }
  return '';
}

/** "Follows your W5 speed edit · plan 12.5 km/h" for an untouched week whose value moved because of an earlier edit. */
export function followNote(plan: Plan, slot: Slot, workout: Workout, overrides: readonly Override[]): string | null {
  if (workout.edited) return null;
  const generated = slotAt(plan, slot, workout.week, EMPTY_INDEX)?.actual;
  if (!generated || JSON.stringify(generated) === JSON.stringify(workout.actual)) return null;
  const sources = overrides.filter((o) => o.slotId === slot.id && o.week < workout.week && o.values);
  const source = Math.max(0, ...sources.map((o) => o.week));
  if (source === 0) return null;
  return `Follows your W${source} edit · plan ${planText(generated)}`;
}

function planText(values: WorkoutValues): string {
  return values.kind === 'intervals' ? `${fmtSpeed(values.speedKmh)} km/h` : describeValues(values);
}

export interface Trend {
  values: number[];
  /** Position of this week within `values`. */
  currentIndex: number;
}

const TREND_BEFORE = 3;
const TREND_AFTER = 4;

/** The values of eight neighbouring weeks (this week is the fourth), for the mini chart on a week row. */
export function trendOf(plan: Plan, slot: Slot, week: number, index: OverrideIndex): Trend {
  const values: number[] = [];
  let currentIndex = 0;
  for (let w = Math.max(1, week - TREND_BEFORE); w <= week + TREND_AFTER; w++) {
    const workout = slotAt(plan, slot, w, index);
    if (!workout) continue;
    if (w === week) currentIndex = values.length;
    values.push(trendValue(workout.actual));
  }
  return { values, currentIndex };
}

function trendValue(values: WorkoutValues): number {
  switch (values.kind) {
    case 'strength':
      return values.exercises[0]?.reps ?? 0;
    case 'run':
    case 'tempo':
      return values.km;
    case 'intervals':
      return values.speedKmh;
  }
}

export function trendLabel(slot: Slot): string {
  switch (slot.type) {
    case 'lower':
    case 'upper':
      return 'Reps trend';
    case 'intervals':
      return 'Speed trend';
    default:
      return 'Distance trend';
  }
}
