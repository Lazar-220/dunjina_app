import { indexOverrides } from './schedule';
import { easyRunSlot, makePlan, override, squatSlot } from './test-fixtures';
import {
  hasErrors,
  validateExerciseConfig,
  validateIntervalDrafts,
  validatePlanBasics,
  validatePlanEnd,
  validateRunConfig,
} from './validation';

describe('validateRunConfig', () => {
  it('accepts a sound config without issues', () => {
    expect(validateRunConfig({ current: 8, min: 6, max: 12, step: 1 })).toEqual([]);
  });

  it('warns, without blocking, when min is above max', () => {
    const issues = validateRunConfig({ current: 10, min: 10, max: 8, step: 1 });
    expect(issues).toContainEqual({
      field: 'min',
      severity: 'warning',
      message: 'Min is above max. Set min to 8 km or lower, or raise max.',
    });
    expect(hasErrors(issues)).toBe(false);
  });

  it('warns when the step is zero or negative', () => {
    expect(validateRunConfig({ current: 8, min: 6, max: 12, step: 0 }).map((i) => i.field)).toEqual(['step']);
    expect(validateRunConfig({ current: 8, min: 6, max: 12, step: -1 }).map((i) => i.severity)).toEqual(['warning']);
  });

  it('warns that week 2 resets when current is above max', () => {
    expect(validateRunConfig({ current: 11, min: 4, max: 9, step: 1 })).toEqual([
      {
        field: 'current',
        severity: 'warning',
        message: 'Above max (9 km). Week 1 runs 11 km, then week 2 resets to 4 km.',
      },
    ]);
  });

  it('warns when current is below min', () => {
    const [issue] = validateRunConfig({ current: 3, min: 6, max: 12, step: 2 });
    expect(issue?.message).toBe('Below min (6 km). Week 1 runs 3 km, then it steps up by 2 km.');
  });
});

describe('validateExerciseConfig', () => {
  const [exercise] = squatSlot().exercises;
  if (!exercise) throw new Error('Fixture has no exercise.');

  it('accepts a sound exercise', () => {
    expect(validateExerciseConfig(exercise)).toEqual([]);
  });

  it('blocks a missing name', () => {
    const issues = validateExerciseConfig({ ...exercise, name: '  ' });
    expect(hasErrors(issues)).toBe(true);
  });

  it('warns on min above max, zero reps step and current outside the range', () => {
    const issues = validateExerciseConfig({ ...exercise, minReps: 12, maxReps: 8, repsStep: 0, currentReps: 20 });
    expect(issues.map((i) => i.field)).toEqual(['minReps', 'repsStep', 'currentReps']);
    expect(hasErrors(issues)).toBe(false);
  });

  it('warns on a negative weight step', () => {
    expect(validateExerciseConfig({ ...exercise, kgStep: -2.5 }).map((i) => i.field)).toEqual(['kgStep']);
  });
});

describe('validatePlanBasics', () => {
  it('blocks an end date on or before the start date', () => {
    const base = { name: 'Autumn base', startDate: '2026-09-21' };
    expect(validatePlanBasics({ ...base, endDate: '2026-09-14' })).toEqual([
      { field: 'endDate', severity: 'error', message: 'End date must be after the start date.' },
    ]);
    expect(hasErrors(validatePlanBasics({ ...base, endDate: '2026-09-21' }))).toBe(true);
  });

  it('accepts an open-ended plan and a later end date', () => {
    expect(validatePlanBasics({ name: 'Autumn base', startDate: '2026-09-21', endDate: null })).toEqual([]);
    expect(validatePlanBasics({ name: 'Autumn base', startDate: '2026-09-21', endDate: '2026-12-20' })).toEqual([]);
  });

  it('blocks an empty name', () => {
    expect(hasErrors(validatePlanBasics({ name: ' ', startDate: '2026-09-21', endDate: null }))).toBe(true);
  });
});

describe('validateIntervalDrafts', () => {
  it('requires at least one draft', () => {
    expect(hasErrors(validateIntervalDrafts([]))).toBe(true);
    expect(validateIntervalDrafts([{ count: 5, distanceM: 400, restS: 90 }])).toEqual([]);
  });
});

describe('validatePlanEnd', () => {
  const plan = makePlan([easyRunSlot()]);
  const index = indexOverrides([override('easy', 3, { done: true, values: { kind: 'run', km: 10 } })]);

  it('blocks an end date before the last done workout and names its date', () => {
    expect(validatePlanEnd(plan, index, '2026-11-03')).toEqual([
      {
        field: 'endDate',
        severity: 'error',
        message: "The plan can't end before your last done workout on Wed 4 Nov 2026. Pick that date or later.",
      },
    ]);
  });

  it('blocks "End plan" today when a workout later than today is already done', () => {
    expect(hasErrors(validatePlanEnd(plan, index, '2026-10-22'))).toBe(true);
  });

  it('allows ending on the day of the last done workout or later', () => {
    expect(validatePlanEnd(plan, index, '2026-11-04')).toEqual([]);
    expect(validatePlanEnd(plan, index, '2027-01-01')).toEqual([]);
  });

  it('allows any end date while nothing is done', () => {
    expect(validatePlanEnd(plan, indexOverrides([]), '2026-10-20')).toEqual([]);
  });
});
