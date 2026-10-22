import { z } from 'zod';
import { isValidIsoDate } from './dates';

export const isoDateSchema = z
  .string()
  .refine(isValidIsoDate, { message: 'Expected a calendar date as YYYY-MM-DD.' });

const weekdaySchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

export const slotTypeSchema = z.enum(['lower', 'upper', 'easy', 'long', 'tempo', 'intervals']);

const idSchema = z.string().min(1);

// ---------- slot configuration ----------

export const runConfigSchema = z.object({
  current: z.number(),
  min: z.number(),
  max: z.number(),
  step: z.number(),
});

export const exerciseConfigSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  sets: z.number().int().min(1),
  currentReps: z.number(),
  minReps: z.number(),
  maxReps: z.number(),
  repsStep: z.number(),
  currentKg: z.number(),
  /** Added only in the week reps reset to min. */
  kgStep: z.number(),
  note: z.string().optional(),
});

export const intervalDraftSchema = z.object({
  count: z.number().int().min(1),
  distanceM: z.number().positive(),
  restS: z.number().min(0),
});

const slotBase = {
  id: idSchema,
  label: z.string().optional(),
  /** null: the draft has no day and shows as "unassigned" in its week. */
  defaultWeekday: weekdaySchema.nullable(),
};

function strengthSlot<T extends 'lower' | 'upper'>(type: T) {
  return z.object({ ...slotBase, type: z.literal(type), exercises: z.array(exerciseConfigSchema) });
}

function runSlot<T extends 'easy' | 'long'>(type: T) {
  return z.object({ ...slotBase, type: z.literal(type), run: runConfigSchema });
}

const tempoSlotSchema = z.object({
  ...slotBase,
  type: z.literal('tempo'),
  run: runConfigSchema,
  warmupKm: z.number().min(0),
  cooldownKm: z.number().min(0),
});

const intervalsSlotSchema = z.object({
  ...slotBase,
  type: z.literal('intervals'),
  /** D = drafts.length = cycle length in weeks. */
  drafts: z.array(intervalDraftSchema).min(1),
  startSpeedKmh: z.number(),
  speedStepKmh: z.number(),
  warmupKm: z.number().min(0),
  cooldownKm: z.number().min(0),
});

export const slotSchema = z.discriminatedUnion('type', [
  strengthSlot('lower'),
  strengthSlot('upper'),
  runSlot('easy'),
  runSlot('long'),
  tempoSlotSchema,
  intervalsSlotSchema,
]);

export const planSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  startDate: isoDateSchema,
  endDate: isoDateSchema.nullable(),
  /** Set by "End plan"; the plan cannot be restarted. */
  endedOn: isoDateSchema.nullable(),
  slots: z.array(slotSchema),
});

// ---------- overrides ----------

/**
 * Values a user logged or edited. A "done" override stores every field (a snapshot);
 * a not-done edit stores only the fields that differ from the generated value.
 */
export const overrideValuesSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('strength'),
    exercises: z.array(
      z.object({
        exerciseId: idSchema,
        sets: z.number().int().min(1).optional(),
        reps: z.number().optional(),
        kg: z.number().optional(),
      }),
    ),
  }),
  z.object({ kind: z.literal('run'), km: z.number().optional() }),
  z.object({
    kind: z.literal('tempo'),
    km: z.number().optional(),
    warmupKm: z.number().optional(),
    cooldownKm: z.number().optional(),
  }),
  z.object({
    kind: z.literal('intervals'),
    speedKmh: z.number().optional(),
    count: z.number().int().min(1).optional(),
    distanceM: z.number().positive().optional(),
    restS: z.number().min(0).optional(),
    warmupKm: z.number().optional(),
    cooldownKm: z.number().optional(),
  }),
]);

export const overrideSchema = z.object({
  planId: idSchema,
  slotId: idSchema,
  /** 1-based plan week. */
  week: z.number().int().min(1),
  values: overrideValuesSchema.optional(),
  /** Moved date; changes only this week's instance. */
  date: isoDateSchema.optional(),
  done: z.boolean().optional(),
  deleted: z.boolean().optional(),
});

// ---------- one-off workouts ----------

/** Values of a one-off workout; unlike overrides, every field is required because there is no plan to fall back on. */
export const oneOffDetailsSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('strength'),
    exercises: z.array(
      z.object({ name: z.string().min(1), sets: z.number().int().min(1), reps: z.number(), kg: z.number() }),
    ),
  }),
  z.object({ kind: z.literal('run'), km: z.number() }),
  z.object({ kind: z.literal('tempo'), km: z.number(), warmupKm: z.number(), cooldownKm: z.number() }),
  z.object({
    kind: z.literal('intervals'),
    count: z.number().int().min(1),
    distanceM: z.number().positive(),
    restS: z.number().min(0),
    speedKmh: z.number(),
    warmupKm: z.number(),
    cooldownKm: z.number(),
  }),
]);

export const KIND_OF_TYPE = {
  lower: 'strength',
  upper: 'strength',
  easy: 'run',
  long: 'run',
  tempo: 'tempo',
  intervals: 'intervals',
} as const;

export const oneOffSchema = z
  .object({
    id: idSchema,
    date: isoDateSchema,
    type: slotTypeSchema,
    done: z.boolean(),
    details: oneOffDetailsSchema,
  })
  .refine((oneOff) => oneOff.details.kind === KIND_OF_TYPE[oneOff.type], {
    message: 'Workout details do not match the workout type.',
    path: ['details'],
  });

// ---------- types ----------

export type SlotType = z.infer<typeof slotTypeSchema>;
export type OneOffDetails = z.infer<typeof oneOffDetailsSchema>;
export type OneOff = z.infer<typeof oneOffSchema>;

export type RunConfig = z.infer<typeof runConfigSchema>;
export type ExerciseConfig = z.infer<typeof exerciseConfigSchema>;
export type IntervalDraft = z.infer<typeof intervalDraftSchema>;
export type Slot = z.infer<typeof slotSchema>;
export type Plan = z.infer<typeof planSchema>;
export type OverrideValues = z.infer<typeof overrideValuesSchema>;
export type Override = z.infer<typeof overrideSchema>;

export type StrengthSlot = Extract<Slot, { type: 'lower' | 'upper' }>;
export type RunSlot = Extract<Slot, { type: 'easy' | 'long' }>;
export type TempoSlot = Extract<Slot, { type: 'tempo' }>;
export type IntervalsSlot = Extract<Slot, { type: 'intervals' }>;
