import { compareDates, type IsoDate } from './dates';
import type { ExerciseConfig, IntervalDraft, RunConfig } from './schema';

/**
 * error: the form cannot be saved or advanced (the data would be structurally unusable).
 * warning: the rule is unusual but still allowed; the engine handles it without throwing.
 */
export type Severity = 'error' | 'warning';

export interface Issue {
  /** Which field the message belongs to, e.g. "min" or "endDate". */
  field: string;
  severity: Severity;
  message: string;
}

const fmt = (n: number) => String(Math.round(n * 100) / 100);

export function validateRunConfig(config: RunConfig, unit = 'km'): Issue[] {
  const issues: Issue[] = [];
  if (config.min > config.max) {
    issues.push({
      field: 'min',
      severity: 'warning',
      message: `Min is above max. Set min to ${fmt(config.max)} ${unit} or lower, or raise max.`,
    });
  }
  if (config.step <= 0) {
    issues.push({ field: 'step', severity: 'warning', message: 'Step should be above 0, otherwise the value never grows.' });
  }
  if (config.current > config.max) {
    issues.push({
      field: 'current',
      severity: 'warning',
      message: `Above max (${fmt(config.max)} ${unit}). Week 1 runs ${fmt(config.current)} ${unit}, then week 2 resets to ${fmt(config.min)} ${unit}.`,
    });
  } else if (config.current < config.min) {
    issues.push({
      field: 'current',
      severity: 'warning',
      message: `Below min (${fmt(config.min)} ${unit}). Week 1 runs ${fmt(config.current)} ${unit}, then it steps up by ${fmt(config.step)} ${unit}.`,
    });
  }
  return issues;
}

export function validateExerciseConfig(config: ExerciseConfig): Issue[] {
  const issues: Issue[] = [];
  if (config.name.trim() === '') {
    issues.push({ field: 'name', severity: 'error', message: 'Give the exercise a name.' });
  }
  if (config.minReps > config.maxReps) {
    issues.push({
      field: 'minReps',
      severity: 'warning',
      message: `Min reps is above max. Set min to ${fmt(config.maxReps)} or lower, or raise max.`,
    });
  }
  if (config.repsStep <= 0) {
    issues.push({ field: 'repsStep', severity: 'warning', message: 'Reps step should be above 0, otherwise reps never grow.' });
  }
  if (config.currentReps > config.maxReps) {
    issues.push({
      field: 'currentReps',
      severity: 'warning',
      message: `Above max (${fmt(config.maxReps)} reps). Week 1 has ${fmt(config.currentReps)} reps, then week 2 resets to ${fmt(config.minReps)} and the weight goes up.`,
    });
  } else if (config.currentReps < config.minReps) {
    issues.push({
      field: 'currentReps',
      severity: 'warning',
      message: `Below min (${fmt(config.minReps)} reps). Week 1 has ${fmt(config.currentReps)} reps, then it steps up by ${fmt(config.repsStep)}.`,
    });
  }
  if (config.kgStep < 0) {
    issues.push({ field: 'kgStep', severity: 'warning', message: 'A negative weight step lowers the weight at every reset.' });
  }
  return issues;
}

export function validateIntervalDrafts(drafts: readonly IntervalDraft[]): Issue[] {
  if (drafts.length === 0) {
    return [{ field: 'drafts', severity: 'error', message: 'Add at least one interval draft.' }];
  }
  return [];
}

export function validatePlanBasics(basics: { name: string; startDate: IsoDate; endDate: IsoDate | null }): Issue[] {
  const issues: Issue[] = [];
  if (basics.name.trim() === '') {
    issues.push({ field: 'name', severity: 'error', message: 'Give the plan a name.' });
  }
  if (basics.endDate !== null && compareDates(basics.endDate, basics.startDate) <= 0) {
    issues.push({ field: 'endDate', severity: 'error', message: 'End date must be after the start date.' });
  }
  return issues;
}

export const hasErrors = (issues: readonly Issue[]): boolean => issues.some((issue) => issue.severity === 'error');
