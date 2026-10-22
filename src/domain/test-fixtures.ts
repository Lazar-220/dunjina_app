import type { IntervalDraft, IntervalsSlot, Override, Plan, RunConfig, RunSlot, Slot, StrengthSlot, TempoSlot } from './schema';
import type { Weekday } from './dates';
import { computeSlotWeek, indexOverrides, type Workout } from './schedule';

export const PLAN_ID = 'plan-1';
/** A Monday. */
export const START = '2026-10-19';

export function makePlan(slots: Slot[], overrides: Partial<Plan> = {}): Plan {
  return { id: PLAN_ID, name: 'Test plan', startDate: START, endDate: null, endedOn: null, slots, ...overrides };
}

export function squatSlot(overrides: Partial<StrengthSlot> = {}): StrengthSlot {
  return {
    id: 'lower',
    type: 'lower',
    defaultWeekday: 0,
    exercises: [
      {
        id: 'squat',
        name: 'Squat',
        sets: 3,
        currentReps: 6,
        minReps: 6,
        maxReps: 10,
        repsStep: 2,
        currentKg: 60,
        kgStep: 2.5,
      },
    ],
    ...overrides,
  };
}

export function easyRunSlot(run: Partial<RunConfig> = {}, weekday: Weekday | null = 2): RunSlot {
  return { id: 'easy', type: 'easy', defaultWeekday: weekday, run: { current: 8, min: 6, max: 12, step: 1, ...run } };
}

export function tempoSlot(overrides: Partial<TempoSlot> = {}): TempoSlot {
  return {
    id: 'tempo',
    type: 'tempo',
    defaultWeekday: 4,
    run: { current: 3, min: 2, max: 6, step: 1 },
    warmupKm: 2,
    cooldownKm: 1.5,
    ...overrides,
  };
}

export const DRAFTS: IntervalDraft[] = [
  { count: 6, distanceM: 300, restS: 60 },
  { count: 5, distanceM: 400, restS: 90 },
  { count: 4, distanceM: 800, restS: 120 },
];

export function intervalsSlot(overrides: Partial<IntervalsSlot> = {}): IntervalsSlot {
  return {
    id: 'intervals',
    type: 'intervals',
    defaultWeekday: 1,
    drafts: DRAFTS,
    startSpeedKmh: 15,
    speedStepKmh: 0.5,
    warmupKm: 2,
    cooldownKm: 1.5,
    ...overrides,
  };
}

export function override(slotId: string, week: number, rest: Partial<Override> = {}): Override {
  return { planId: PLAN_ID, slotId, week, ...rest };
}

/** The computed workout of one slot in one week; fails the test if it does not exist. */
export function workoutAt(plan: Plan, slotId: string, week: number, overrides: Override[] = []): Workout {
  const slot = plan.slots.find((s) => s.id === slotId);
  if (!slot) throw new Error(`No slot ${slotId} in the test plan.`);
  const workout = computeSlotWeek(plan, slot, week, indexOverrides(overrides));
  if (!workout) throw new Error(`No workout for ${slotId} in week ${week}.`);
  return workout;
}

export function weeks(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
