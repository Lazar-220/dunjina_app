import { mondayOf, type IsoDate, type Weekday } from '../../domain/dates';
import { runningKm } from '../../domain/metrics';
import type { ExerciseConfig, Plan, Slot, SlotType } from '../../domain/schema';
import { computeSlotWeek, indexOverrides, type Workout } from '../../domain/schedule';
import {
  hasErrors,
  validateExerciseConfig,
  validateIntervalDrafts,
  validatePlanBasics,
  validateRunConfig,
  type Issue,
} from '../../domain/validation';
import { TYPE_META } from '../../shared/workout-types';

export type WizardStep = 'basics' | 'structure' | 'slots' | 'review';

/** Everything the wizard edits; becomes a Plan on save. */
export interface WizardDraft {
  name: string;
  startDate: IsoDate;
  /** null: open-ended. */
  endDate: IsoDate | null;
  slots: Slot[];
}

export const PROJECTED_WEEKS = 8;

export function emptyDraft(today: IsoDate): WizardDraft {
  return { name: '', startDate: mondayOf(today), endDate: null, slots: [] };
}

export function draftFromPlan(plan: Plan): WizardDraft {
  return { name: plan.name, startDate: plan.startDate, endDate: plan.endDate, slots: plan.slots };
}

/** A copy of an existing plan as a new plan: fresh ids, starting this week, open-ended. */
export function duplicateDraft(plan: Plan, today: IsoDate, newId: () => string): WizardDraft {
  const slots = plan.slots.map((slot): Slot => {
    if (slot.type === 'lower' || slot.type === 'upper') {
      return { ...slot, id: newId(), exercises: slot.exercises.map((e) => ({ ...e, id: newId() })) };
    }
    return { ...slot, id: newId() };
  });
  return { name: `${plan.name} (copy)`, startDate: mondayOf(today), endDate: null, slots };
}

// ---------- slots ----------

const PREFERRED_WEEKDAY: Record<SlotType, Weekday> = { lower: 0, intervals: 1, easy: 2, upper: 3, tempo: 4, long: 6 };

/** The type's usual weekday if free, else the first day without a workout, else none. */
export function suggestWeekday(type: SlotType, slots: readonly Slot[]): Weekday | null {
  const taken = new Set(slots.map((slot) => slot.defaultWeekday));
  const preferred = PREFERRED_WEEKDAY[type];
  if (!taken.has(preferred)) return preferred;
  const free = ([0, 1, 2, 3, 4, 5, 6] as const).find((day) => !taken.has(day));
  return free ?? null;
}

export function newExercise(newId: () => string, name = 'Exercise'): ExerciseConfig {
  return {
    id: newId(),
    name,
    sets: 3,
    currentReps: 6,
    minReps: 6,
    maxReps: 10,
    repsStep: 2,
    currentKg: 40,
    kgStep: 2.5,
  };
}

export function newSlot(type: SlotType, existing: readonly Slot[], newId: () => string): Slot {
  const base = { id: newId(), defaultWeekday: suggestWeekday(type, existing) };
  switch (type) {
    case 'lower':
    case 'upper':
      return { ...base, type, exercises: [newExercise(newId)] };
    case 'easy':
      return { ...base, type, run: { current: 5, min: 4, max: 8, step: 1 } };
    case 'long':
      return { ...base, type, run: { current: 10, min: 8, max: 16, step: 1 } };
    case 'tempo':
      return { ...base, type, run: { current: 3, min: 2, max: 6, step: 1 }, warmupKm: 2, cooldownKm: 1.5 };
    case 'intervals':
      return {
        ...base,
        type,
        drafts: [
          { count: 8, distanceM: 400, restS: 60 },
          { count: 5, distanceM: 800, restS: 90 },
          { count: 4, distanceM: 1000, restS: 120 },
        ],
        startSpeedKmh: 12,
        speedStepKmh: 0.5,
        warmupKm: 2,
        cooldownKm: 1.5,
      };
  }
}

/** "Easy run A", "Easy run B" when a type occurs more than once; the plain name otherwise. */
export function slotNames(slots: readonly Slot[]): Map<string, string> {
  const totals = new Map<SlotType, number>();
  for (const slot of slots) totals.set(slot.type, (totals.get(slot.type) ?? 0) + 1);
  const seen = new Map<SlotType, number>();
  return new Map(
    slots.map((slot) => {
      const position = seen.get(slot.type) ?? 0;
      seen.set(slot.type, position + 1);
      const name = TYPE_META[slot.type].name;
      const label = (totals.get(slot.type) ?? 0) > 1 ? `${name} ${String.fromCharCode(65 + position)}` : name;
      return [slot.id, label];
    }),
  );
}

/** Stores a label only on slots whose type occurs more than once, so a lone slot keeps the plain type name. */
export function assignLabels(slots: readonly Slot[]): Slot[] {
  const names = slotNames(slots);
  return slots.map((slot) => {
    const name = names.get(slot.id);
    const duplicated = name !== undefined && name !== TYPE_META[slot.type].name;
    const { label, ...rest } = slot;
    return duplicated ? { ...rest, label: name } : rest;
  });
}

// ---------- validation ----------

export function slotIssues(slot: Slot): Issue[] {
  switch (slot.type) {
    case 'lower':
    case 'upper':
      return slot.exercises.length === 0
        ? [{ field: 'exercises', severity: 'error', message: 'Add at least one exercise.' }]
        : slot.exercises.flatMap(validateExerciseConfig);
    case 'easy':
    case 'long':
    case 'tempo':
      return validateRunConfig(slot.run);
    case 'intervals':
      return validateIntervalDrafts(slot.drafts);
  }
}

export function stepIssues(draft: WizardDraft, step: Exclude<WizardStep, 'review'>): Issue[] {
  switch (step) {
    case 'basics':
      return validatePlanBasics(draft);
    case 'structure':
      return draft.slots.length === 0
        ? [{ field: 'slots', severity: 'error', message: 'Add at least one workout to the weekly structure.' }]
        : [];
    case 'slots':
      return draft.slots.flatMap(slotIssues);
  }
}

export const canAdvance = (draft: WizardDraft, step: Exclude<WizardStep, 'review'>): boolean =>
  !hasErrors(stepIssues(draft, step));

// ---------- saving ----------

export function toPlan(draft: WizardDraft, id: string, endedOn: IsoDate | null = null): Plan {
  return {
    id,
    name: draft.name.trim(),
    startDate: draft.startDate,
    endDate: draft.endDate,
    endedOn,
    slots: assignLabels(draft.slots),
  };
}

// ---------- projections (computed by the same engine that renders the weeks) ----------

function projectionPlan(draft: WizardDraft): Plan {
  return toPlan(draft, 'projection');
}

/** The first `weeks` generated workouts of one slot. */
export function projectSlot(draft: WizardDraft, slotId: string, weeks = PROJECTED_WEEKS): Workout[] {
  const plan = projectionPlan(draft);
  const slot = plan.slots.find((s) => s.id === slotId);
  if (!slot) return [];
  const index = indexOverrides([]);
  return Array.from({ length: weeks }, (_, i) => computeSlotWeek(plan, slot, i + 1, index)).filter(
    (workout): workout is Workout => workout !== null,
  );
}

/** Running distance per week over the first `weeks` weeks, all slots together. */
export function weeklyRunningKm(draft: WizardDraft, weeks = PROJECTED_WEEKS): number[] {
  const totals = Array.from({ length: weeks }, () => 0);
  for (const slot of draft.slots) {
    for (const workout of projectSlot(draft, slot.id, weeks)) {
      totals[workout.week - 1] = (totals[workout.week - 1] ?? 0) + runningKm(workout.actual);
    }
  }
  return totals;
}

export function weeklyCounts(slots: readonly Slot[]): { strength: number; running: number } {
  const strength = slots.filter((s) => TYPE_META[s.type].group === 'Strength').length;
  return { strength, running: slots.length - strength };
}
