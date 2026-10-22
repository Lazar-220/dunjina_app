import { z } from 'zod';
import { isoDateSchema, KIND_OF_TYPE, oneOffSchema, overrideSchema, planSchema, type OneOff, type Override, type Plan } from '../domain/schema';

export const BACKUP_MARKER = 'training-planner';
export const BACKUP_VERSION = 1;

/** Everything the app stores except device preferences. */
export interface BackupData {
  plans: Plan[];
  overrides: Override[];
  oneOffs: OneOff[];
}

const backupSchema = z
  .object({
    schema: z.literal(BACKUP_MARKER),
    schemaVersion: z.literal(BACKUP_VERSION),
    exportedOn: isoDateSchema,
    plans: z.array(planSchema),
    overrides: z.array(overrideSchema),
    oneOffs: z.array(oneOffSchema),
  })
  .superRefine((backup, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    const slotsByPlan = new Map<string, Map<string, Plan['slots'][number]>>();
    for (const plan of backup.plans) {
      if (slotsByPlan.has(plan.id)) fail(`Plan id "${plan.id}" appears twice.`);
      const slots = new Map<string, Plan['slots'][number]>();
      for (const slot of plan.slots) {
        if (slots.has(slot.id)) fail(`Slot id "${slot.id}" appears twice in plan "${plan.name}".`);
        slots.set(slot.id, slot);
      }
      slotsByPlan.set(plan.id, slots);
    }
    const seen = new Set<string>();
    for (const override of backup.overrides) {
      const slot = slotsByPlan.get(override.planId)?.get(override.slotId);
      if (!slot) {
        fail(`A saved change refers to a slot that is not in the backup (${override.slotId}, week ${override.week}).`);
        continue;
      }
      if (override.values && override.values.kind !== KIND_OF_TYPE[slot.type]) {
        fail(`A saved change for "${slot.label ?? slot.type}", week ${override.week}, has the wrong kind of values.`);
      }
      const key = `${override.planId}|${override.slotId}|${override.week}`;
      if (seen.has(key)) fail(`Week ${override.week} of "${slot.label ?? slot.type}" has two saved changes.`);
      seen.add(key);
    }
    const oneOffIds = new Set<string>();
    for (const oneOff of backup.oneOffs) {
      if (oneOffIds.has(oneOff.id)) fail(`One-off workout id "${oneOff.id}" appears twice.`);
      oneOffIds.add(oneOff.id);
    }
  });

export type BackupFile = z.infer<typeof backupSchema>;

export type BackupError =
  | { kind: 'not-json' }
  | { kind: 'wrong-format' }
  | { kind: 'newer-version'; version: number }
  | { kind: 'invalid'; problems: string[] };

export type ParsedBackup = { ok: true; backup: BackupFile } | { ok: false; error: BackupError };

const MAX_REPORTED_PROBLEMS = 3;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validates a backup file's text. Never throws; the caller decides what to do with the result. */
export function parseBackup(text: string): ParsedBackup {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: { kind: 'not-json' } };
  }
  if (!isRecord(json) || json['schema'] !== BACKUP_MARKER) {
    return { ok: false, error: { kind: 'wrong-format' } };
  }
  const version = json['schemaVersion'];
  if (typeof version === 'number' && version > BACKUP_VERSION) {
    return { ok: false, error: { kind: 'newer-version', version } };
  }
  const result = backupSchema.safeParse(json);
  if (!result.success) {
    const problems = result.error.issues.slice(0, MAX_REPORTED_PROBLEMS).map((issue) => {
      const where = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
      return `${where}${issue.message}`;
    });
    return { ok: false, error: { kind: 'invalid', problems } };
  }
  return { ok: true, backup: result.data };
}

export function backupErrorMessage(error: BackupError): { title: string; detail: string } {
  switch (error.kind) {
    case 'not-json':
      return { title: 'Can’t read this file.', detail: 'It isn’t a valid JSON file. Nothing was changed.' };
    case 'wrong-format':
      return {
        title: 'Can’t read this file.',
        detail: 'It isn’t a Training Planner backup (format marker missing). Nothing was changed.',
      };
    case 'newer-version':
      return {
        title: `Newer backup format (v${error.version}).`,
        detail: 'Update the app to import this file. Nothing was changed.',
      };
    case 'invalid':
      return {
        title: 'This backup is damaged.',
        detail: `${error.problems.join(' ')} Nothing was changed.`,
      };
  }
}

export function serializeBackup(data: BackupData, exportedOn: string): string {
  const file: BackupFile = { schema: BACKUP_MARKER, schemaVersion: BACKUP_VERSION, exportedOn, ...data };
  return JSON.stringify(file, null, 2);
}

export function backupFileName(exportedOn: string): string {
  return `training-planner-${exportedOn}.json`;
}

export interface BackupSummary {
  plans: number;
  workoutsDone: number;
}

export function summarizeBackup(data: BackupData): BackupSummary {
  const doneChanges = data.overrides.filter((o) => o.done && !o.deleted).length;
  const doneOneOffs = data.oneOffs.filter((o) => o.done).length;
  return { plans: data.plans.length, workoutsDone: doneChanges + doneOneOffs };
}
