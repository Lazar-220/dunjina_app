import { previewImpact } from '../../domain/impact';
import type { Override } from '../../domain/schema';
import { indexOverrides, type WorkoutValues } from '../../domain/schedule';
import {
  easyRunSlot,
  intervalsSlot,
  makePlan,
  override,
  squatSlot,
  tempoSlot,
  workoutAt,
} from '../../domain/test-fixtures';
import { oneOffToValues, valuesToOneOffDetails } from './calendar-item';
import { describeValues } from './describe';
import { buildOverride, differencesOf, distanceOf, snapshotOf, withDistance, withMovedDate } from './edit-model';
import { impactGroups } from './impact-view';

const strength = (reps: number, kg: number): WorkoutValues => ({
  kind: 'strength',
  exercises: [{ exerciseId: 'squat', name: 'Squat', sets: 3, reps, kg }],
});

describe('differencesOf', () => {
  it('returns undefined when nothing changed', () => {
    expect(differencesOf(strength(8, 60), strength(8, 60))).toBeUndefined();
    expect(differencesOf({ kind: 'run', km: 9 }, { kind: 'run', km: 9 })).toBeUndefined();
  });

  it('keeps only the changed strength fields', () => {
    expect(differencesOf(strength(8, 60), strength(8, 57.5))).toEqual({
      kind: 'strength',
      exercises: [{ exerciseId: 'squat', kg: 57.5 }],
    });
  });

  it('keeps only the changed interval fields', () => {
    const planned = workoutAt(makePlan([intervalsSlot()]), 'intervals', 2).planned;
    if (planned.kind !== 'intervals') throw new Error('Not intervals.');
    expect(differencesOf(planned, { ...planned, speedKmh: 14, count: 4 })).toEqual({
      kind: 'intervals',
      speedKmh: 14,
      count: 4,
    });
  });
});

describe('buildOverride', () => {
  const planned = strength(8, 60);
  const base = { planId: 'plan-1', slotId: 'lower', week: 2, planned };

  it('stores a full snapshot when marked done, even without changes', () => {
    const result = buildOverride({ ...base, existing: undefined, form: planned, done: true });
    expect(result).toEqual({
      planId: 'plan-1',
      slotId: 'lower',
      week: 2,
      done: true,
      values: { kind: 'strength', exercises: [{ exerciseId: 'squat', sets: 3, reps: 8, kg: 60 }] },
    });
  });

  it('stores only differences for an edit that is not done', () => {
    const result = buildOverride({ ...base, existing: undefined, form: strength(6, 60), done: false });
    expect(result?.values).toEqual({ kind: 'strength', exercises: [{ exerciseId: 'squat', reps: 6 }] });
    expect(result?.done).toBeUndefined();
  });

  it('returns null when an edit is reverted to the plan, so the override row is removed', () => {
    expect(buildOverride({ ...base, existing: undefined, form: planned, done: false })).toBeNull();
  });

  it('keeps a moved date and drops stale values', () => {
    const existing: Override = override('lower', 2, { date: '2026-10-22', values: { kind: 'strength', exercises: [{ exerciseId: 'squat', reps: 6 }] } });
    expect(buildOverride({ ...base, existing, form: planned, done: false })).toEqual({
      planId: 'plan-1',
      slotId: 'lower',
      week: 2,
      date: '2026-10-22',
    });
  });

  it('feeds the engine: a snapshot of 6@60 in W4 changes the following weeks', () => {
    const plan = makePlan([squatSlot()]);
    const w4 = workoutAt(plan, 'lower', 4);
    const saved = buildOverride({
      existing: undefined,
      planId: plan.id,
      slotId: 'lower',
      week: 4,
      planned: w4.planned,
      form: strength(6, 60),
      done: true,
    });
    if (!saved) throw new Error('Expected an override.');
    const w5 = workoutAt(plan, 'lower', 5, [saved]).actual;
    expect(w5.kind === 'strength' && `${w5.exercises[0]?.reps}@${w5.exercises[0]?.kg}`).toBe('8@60');
  });
});

describe('snapshotOf', () => {
  it('covers every field of each workout kind', () => {
    expect(snapshotOf({ kind: 'tempo', km: 3, warmupKm: 2, cooldownKm: 1.5 })).toEqual({
      kind: 'tempo',
      km: 3,
      warmupKm: 2,
      cooldownKm: 1.5,
    });
    const intervals = workoutAt(makePlan([intervalsSlot()]), 'intervals', 1).actual;
    expect(snapshotOf(intervals)).toEqual({
      kind: 'intervals',
      speedKmh: 15,
      count: 6,
      distanceM: 300,
      restS: 60,
      warmupKm: 2,
      cooldownKm: 1.5,
    });
  });
});

describe('impactGroups', () => {
  it('lists only the exercises whose following weeks change', () => {
    const base = squatSlot();
    const slot = squatSlot({
      exercises: [
        ...base.exercises,
        { id: 'rdl', name: 'RDL', sets: 3, currentReps: 8, minReps: 8, maxReps: 12, repsStep: 2, currentKg: 50, kgStep: 5 },
      ],
    });
    const plan = makePlan([slot]);
    const w4 = workoutAt(plan, 'lower', 4);
    const form: WorkoutValues = {
      kind: 'strength',
      exercises: [
        { exerciseId: 'squat', name: 'Squat', sets: 3, reps: 6, kg: 60 },
        ...(w4.actual.kind === 'strength' ? w4.actual.exercises.slice(1) : []),
      ],
    };
    const candidate = buildOverride({ existing: undefined, planId: plan.id, slotId: 'lower', week: 4, planned: w4.planned, form, done: true });
    if (!candidate) throw new Error('Expected an override.');
    const groups = impactGroups(previewImpact(plan, slot, candidate, indexOverrides([])));
    expect(groups.map((g) => g.label)).toEqual(['Squat']);
    expect(groups[0]?.cells).toEqual([
      { header: 'W5', was: '8@62.5', now: '8@60', changed: true },
      { header: 'W6', was: '10@62.5', now: '10@60', changed: true },
      { header: 'W7', was: '6@65', now: '6@62.5', changed: true },
    ]);
  });

  it('labels interval weeks with their draft and reports speed only', () => {
    const slot = intervalsSlot();
    const plan = makePlan([slot]);
    const candidate = override('intervals', 2, { values: { kind: 'intervals', speedKmh: 14 } });
    const [group] = impactGroups(previewImpact(plan, slot, candidate, indexOverrides([])));
    expect(group?.label).toBe('Speed in the next weeks');
    expect(group?.cells[0]).toEqual({ header: 'W3 · D3', was: '15.0', now: '14.0', changed: true });
  });

  it('is empty when the following weeks do not change', () => {
    const slot = easyRunSlot();
    const plan = makePlan([slot]);
    const candidate = override('easy', 2, { done: true, values: { kind: 'run', km: 9 } });
    expect(impactGroups(previewImpact(plan, slot, candidate, indexOverrides([])))).toEqual([]);
  });

  it('shows distances with units', () => {
    const slot = tempoSlot();
    const plan = makePlan([slot]);
    const candidate = override('tempo', 1, { values: { kind: 'tempo', km: 5 } });
    const [group] = impactGroups(previewImpact(plan, slot, candidate, indexOverrides([])));
    expect(group?.cells[0]).toEqual({ header: 'W2', was: '4 km', now: '6 km', changed: true });
  });
});

describe('describeValues', () => {
  it('summarizes each kind in one line', () => {
    expect(describeValues(strength(8, 47.5))).toBe('Squat 3×8 @ 47.5 kg');
    expect(describeValues({ kind: 'run', km: 9 })).toBe('9 km');
    expect(describeValues({ kind: 'tempo', km: 2, warmupKm: 2, cooldownKm: 1.5 })).toBe('2 km tempo · 5.5 km total');
    const intervals = workoutAt(makePlan([intervalsSlot()]), 'intervals', 2).actual;
    expect(describeValues(intervals)).toBe('5 × 400 m · 15.0 km/h');
  });

  it('counts the other exercises of a strength workout', () => {
    const two: WorkoutValues = {
      kind: 'strength',
      exercises: [
        { exerciseId: 'a', name: 'Bench', sets: 3, reps: 8, kg: 47.5 },
        { exerciseId: 'b', name: 'Row', sets: 3, reps: 10, kg: 42.5 },
        { exerciseId: 'c', name: 'OHP', sets: 3, reps: 10, kg: 32.5 },
      ],
    };
    expect(describeValues(two)).toBe('Bench 3×8 @ 47.5 kg · +2 more');
  });
});

describe('one-off conversion', () => {
  it('round-trips every kind through the shared value shape', () => {
    const details = [
      { kind: 'strength' as const, exercises: [{ name: 'Press', sets: 3, reps: 8, kg: 30 }] },
      { kind: 'run' as const, km: 5 },
      { kind: 'tempo' as const, km: 3, warmupKm: 2, cooldownKm: 1.5 },
      { kind: 'intervals' as const, count: 5, distanceM: 400, restS: 90, speedKmh: 12, warmupKm: 2, cooldownKm: 1.5 },
    ];
    for (const d of details) expect(valuesToOneOffDetails(oneOffToValues(d))).toEqual(d);
  });
});

describe('withMovedDate', () => {
  const key = { planId: 'plan-1', slotId: 'easy', week: 2 };

  it('creates a date-only override for a move', () => {
    expect(withMovedDate(null, key, '2026-10-30', '2026-10-28')).toEqual({ ...key, date: '2026-10-30' });
  });

  it('keeps the values of an existing override', () => {
    const existing: Override = { ...key, values: { kind: 'run', km: 7 } };
    expect(withMovedDate(existing, key, '2026-10-30', '2026-10-28')).toEqual({ ...existing, date: '2026-10-30' });
  });

  it('drops the date when moved back to the generated day, and the whole override when nothing is left', () => {
    expect(withMovedDate({ ...key, date: '2026-10-30' }, key, '2026-10-28', '2026-10-28')).toBeNull();
    const edited: Override = { ...key, date: '2026-10-30', values: { kind: 'run', km: 7 } };
    expect(withMovedDate(edited, key, '2026-10-28', '2026-10-28')).toEqual({ ...key, values: { kind: 'run', km: 7 } });
  });
});

describe('distanceOf and withDistance', () => {
  it('read and change the distance of runs and tempo workouts only', () => {
    expect(distanceOf({ kind: 'run', km: 9 })).toBe(9);
    expect(distanceOf({ kind: 'tempo', km: 3, warmupKm: 2, cooldownKm: 1.5 })).toBe(3);
    expect(distanceOf(strength(8, 60))).toBeNull();
    expect(withDistance({ kind: 'tempo', km: 3, warmupKm: 2, cooldownKm: 1.5 }, 5)).toEqual({ kind: 'tempo', km: 5, warmupKm: 2, cooldownKm: 1.5 });
    expect(withDistance(strength(8, 60), 5)).toEqual(strength(8, 60));
  });
});
