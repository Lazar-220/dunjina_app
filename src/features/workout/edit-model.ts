import type { Override, OverrideValues } from '../../domain/schema';
import type { WorkoutValues } from '../../domain/schedule';

/** Every field of the workout, so later edits to the plan can never rewrite what the user logged. */
export function snapshotOf(values: WorkoutValues): OverrideValues {
  switch (values.kind) {
    case 'strength':
      return {
        kind: 'strength',
        exercises: values.exercises.map(({ exerciseId, sets, reps, kg }) => ({ exerciseId, sets, reps, kg })),
      };
    case 'run':
      return { kind: 'run', km: values.km };
    case 'tempo':
      return { kind: 'tempo', km: values.km, warmupKm: values.warmupKm, cooldownKm: values.cooldownKm };
    case 'intervals':
      return {
        kind: 'intervals',
        speedKmh: values.speedKmh,
        count: values.count,
        distanceM: values.distanceM,
        restS: values.restS,
        warmupKm: values.warmupKm,
        cooldownKm: values.cooldownKm,
      };
  }
}

/** Only the fields that differ from the plan, or undefined when nothing differs. */
export function differencesOf(planned: WorkoutValues, edited: WorkoutValues): OverrideValues | undefined {
  if (planned.kind === 'strength' && edited.kind === 'strength') {
    const exercises = edited.exercises.flatMap((exercise) => {
      const plan = planned.exercises.find((e) => e.exerciseId === exercise.exerciseId);
      if (!plan) return [];
      const changes = {
        ...(exercise.sets !== plan.sets && { sets: exercise.sets }),
        ...(exercise.reps !== plan.reps && { reps: exercise.reps }),
        ...(exercise.kg !== plan.kg && { kg: exercise.kg }),
      };
      return Object.keys(changes).length > 0 ? [{ exerciseId: exercise.exerciseId, ...changes }] : [];
    });
    return exercises.length > 0 ? { kind: 'strength', exercises } : undefined;
  }
  if (planned.kind === 'run' && edited.kind === 'run') {
    return edited.km !== planned.km ? { kind: 'run', km: edited.km } : undefined;
  }
  if (planned.kind === 'tempo' && edited.kind === 'tempo') {
    const changes = {
      ...(edited.km !== planned.km && { km: edited.km }),
      ...(edited.warmupKm !== planned.warmupKm && { warmupKm: edited.warmupKm }),
      ...(edited.cooldownKm !== planned.cooldownKm && { cooldownKm: edited.cooldownKm }),
    };
    return Object.keys(changes).length > 0 ? { kind: 'tempo', ...changes } : undefined;
  }
  if (planned.kind === 'intervals' && edited.kind === 'intervals') {
    const changes = {
      ...(edited.speedKmh !== planned.speedKmh && { speedKmh: edited.speedKmh }),
      ...(edited.count !== planned.count && { count: edited.count }),
      ...(edited.distanceM !== planned.distanceM && { distanceM: edited.distanceM }),
      ...(edited.restS !== planned.restS && { restS: edited.restS }),
      ...(edited.warmupKm !== planned.warmupKm && { warmupKm: edited.warmupKm }),
      ...(edited.cooldownKm !== planned.cooldownKm && { cooldownKm: edited.cooldownKm }),
    };
    return Object.keys(changes).length > 0 ? { kind: 'intervals', ...changes } : undefined;
  }
  return undefined;
}

interface BuildOverrideInput {
  existing: Override | undefined;
  planId: string;
  slotId: string;
  week: number;
  planned: WorkoutValues;
  form: WorkoutValues;
  done: boolean;
}

/**
 * The override to store for a saved form. Done workouts store a full snapshot, edits that are not done store
 * only differences. Returns null when nothing is left to store, meaning the override row should be removed.
 * A moved date and a deleted flag of the existing override are kept.
 */
export function buildOverride({ existing, planId, slotId, week, planned, form, done }: BuildOverrideInput): Override | null {
  const values = done ? snapshotOf(form) : differencesOf(planned, form);
  const override: Override = {
    planId,
    slotId,
    week,
    ...(values && { values }),
    ...(existing?.date && { date: existing.date }),
    ...(existing?.deleted && { deleted: true }),
    ...(done && { done: true }),
  };
  const hasContent = values || override.date || override.deleted || override.done;
  return hasContent ? override : null;
}
