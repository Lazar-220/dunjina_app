import type { Override } from './schema';
import {
  DRAFTS,
  easyRunSlot,
  intervalsSlot,
  makePlan,
  override,
  squatSlot,
  tempoSlot,
  weeks,
  workoutAt,
} from './test-fixtures';
import type { Workout } from './schedule';

function strengthLabel(workout: Workout, exerciseIndex = 0): string {
  if (workout.actual.kind !== 'strength') throw new Error('Not a strength workout.');
  const exercise = workout.actual.exercises[exerciseIndex];
  if (!exercise) throw new Error('No such exercise.');
  return `${exercise.reps}@${exercise.kg}`;
}

function runKm(workout: Workout): number {
  if (workout.actual.kind !== 'run' && workout.actual.kind !== 'tempo') throw new Error('Not a run.');
  return workout.actual.km;
}

function intervalLabel(workout: Workout): string {
  if (workout.actual.kind !== 'intervals') throw new Error('Not an interval workout.');
  return `D${workout.actual.draft}@${workout.actual.speedKmh}`;
}

const strengthSeries = (overrides: Override[] = []) =>
  weeks(1, 7).map((w) => strengthLabel(workoutAt(makePlan([squatSlot()]), 'lower', w, overrides)));

const runSeries = (run: { current: number; min: number; max: number; step: number }, overrides: Override[] = []) =>
  weeks(1, 7).map((w) => runKm(workoutAt(makePlan([easyRunSlot(run)]), 'easy', w, overrides)));

describe('strength progression', () => {
  it('raises reps by the step, then resets reps and adds weight when max was reached', () => {
    expect(strengthSeries()).toEqual(['6@60', '8@60', '10@60', '6@62.5', '8@62.5', '10@62.5', '6@65']);
  });

  it('continues from the logged value: W4 logged as 6@60 keeps the weight at 60', () => {
    const logged = override('lower', 4, {
      done: true,
      values: { kind: 'strength', exercises: [{ exerciseId: 'squat', sets: 3, reps: 6, kg: 60 }] },
    });
    expect(strengthSeries([logged])).toEqual(['6@60', '8@60', '10@60', '6@60', '8@60', '10@60', '6@62.5']);
  });

  it('gives the same result when W4 is a sparse edit of only the weight', () => {
    const edited = override('lower', 4, {
      values: { kind: 'strength', exercises: [{ exerciseId: 'squat', kg: 60 }] },
    });
    expect(strengthSeries([edited])).toEqual(['6@60', '8@60', '10@60', '6@60', '8@60', '10@60', '6@62.5']);
  });

  it('uses a logged value above max as already at max (next week resets and adds weight)', () => {
    const logged = override('lower', 2, {
      done: true,
      values: { kind: 'strength', exercises: [{ exerciseId: 'squat', sets: 3, reps: 12, kg: 60 }] },
    });
    expect(strengthSeries([logged]).slice(1, 4)).toEqual(['12@60', '6@62.5', '8@62.5']);
  });

  it('progresses every exercise independently', () => {
    const base = squatSlot();
    const plan = makePlan([
      squatSlot({
        exercises: [
          ...base.exercises,
          { id: 'rdl', name: 'RDL', sets: 3, currentReps: 8, minReps: 8, maxReps: 12, repsStep: 2, currentKg: 50, kgStep: 5 },
        ],
      }),
    ]);
    const labels = weeks(1, 4).map((w) => {
      const workout = workoutAt(plan, 'lower', w);
      return `${strengthLabel(workout, 0)} | ${strengthLabel(workout, 1)}`;
    });
    expect(labels).toEqual(['6@60 | 8@50', '8@60 | 10@50', '10@60 | 12@50', '6@62.5 | 8@55']);
  });

  it('rounds weights so additions leave no float noise', () => {
    const slot = squatSlot({
      exercises: [
        { id: 'squat', name: 'Squat', sets: 3, currentReps: 10, minReps: 6, maxReps: 10, repsStep: 2, currentKg: 0.1, kgStep: 0.2 },
      ],
    });
    const plan = makePlan([slot]);
    expect(strengthLabel(workoutAt(plan, 'lower', 2))).toBe('6@0.3');
  });
});

describe('easy run progression', () => {
  it('steps up to max, shows max, and resets to min the next week', () => {
    expect(runSeries({ current: 8, min: 6, max: 12, step: 1 })).toEqual([8, 9, 10, 11, 12, 6, 7]);
  });

  it('caps at max and resets when the step does not land on max', () => {
    expect(runSeries({ current: 8, min: 6, max: 12, step: 3 })).toEqual([8, 11, 12, 6, 9, 12, 6]);
  });

  it('treats a current value above max as already at max: week 1 keeps it, week 2 resets', () => {
    expect(runSeries({ current: 11, min: 4, max: 9, step: 1 })).toEqual([11, 4, 5, 6, 7, 8, 9]);
  });

  it('just applies the step when current is below min', () => {
    expect(runSeries({ current: 3, min: 6, max: 9, step: 2 })).toEqual([3, 5, 7, 9, 6, 8, 9]);
  });

  it('does not throw for min above max and settles on min', () => {
    expect(runSeries({ current: 8, min: 10, max: 6, step: 1 })).toEqual([8, 10, 10, 10, 10, 10, 10]);
  });

  it('continues from an edited value: it becomes the baseline for all following weeks', () => {
    const edited = override('easy', 3, { values: { kind: 'run', km: 7 } });
    expect(runSeries({ current: 8, min: 6, max: 12, step: 1 }, [edited])).toEqual([8, 9, 7, 8, 9, 10, 11]);
  });

  it('uses the nearest preceding override when several exist', () => {
    const first = override('easy', 2, { values: { kind: 'run', km: 7 } });
    const second = override('easy', 5, { values: { kind: 'run', km: 6 } });
    expect(runSeries({ current: 8, min: 6, max: 12, step: 1 }, [first, second])).toEqual([8, 7, 8, 9, 6, 7, 8]);
  });

  it('returns to the generated values when the override is removed (reset)', () => {
    const edited = override('easy', 3, { values: { kind: 'run', km: 7 } });
    const run = { current: 8, min: 6, max: 12, step: 1 };
    expect(runSeries(run, [edited])).not.toEqual(runSeries(run, []));
    expect(runSeries(run, [])).toEqual([8, 9, 10, 11, 12, 6, 7]);
  });

  it('keeps a done snapshot fixed when the plan config changes later', () => {
    const snapshot = override('easy', 2, { done: true, values: { kind: 'run', km: 9 } });
    const changedConfig = makePlan([easyRunSlot({ current: 5 })]);
    expect(runKm(workoutAt(changedConfig, 'easy', 2, [snapshot]))).toBe(9);
    expect(runKm(workoutAt(changedConfig, 'easy', 3, [snapshot]))).toBe(10);
  });
});

describe('tempo progression', () => {
  it('progresses the tempo distance and keeps warm-up and cool-down fixed', () => {
    const plan = makePlan([tempoSlot()]);
    const result = weeks(1, 6).map((w) => {
      const { actual } = workoutAt(plan, 'tempo', w);
      if (actual.kind !== 'tempo') throw new Error('Not tempo.');
      return [actual.km, actual.warmupKm, actual.cooldownKm];
    });
    expect(result).toEqual([
      [3, 2, 1.5],
      [4, 2, 1.5],
      [5, 2, 1.5],
      [6, 2, 1.5],
      [2, 2, 1.5],
      [3, 2, 1.5],
    ]);
  });
});

describe('interval progression', () => {
  const plan = makePlan([intervalsSlot()]);
  const labels = (overrides: Override[] = []) => weeks(1, 7).map((w) => intervalLabel(workoutAt(plan, 'intervals', w, overrides)));

  it('rotates drafts and raises the speed after each full cycle', () => {
    expect(labels()).toEqual(['D1@15', 'D2@15', 'D3@15', 'D1@15.5', 'D2@15.5', 'D3@15.5', 'D1@16']);
  });

  it('carries an edited speed forward, while count/distance/rest stay local to that week', () => {
    const w2 = override('intervals', 2, { values: { kind: 'intervals', speedKmh: 14, count: 4 } });
    expect(labels([w2])).toEqual(['D1@15', 'D2@14', 'D3@14', 'D1@14.5', 'D2@14.5', 'D3@14.5', 'D1@15']);

    const week2 = workoutAt(plan, 'intervals', 2, [w2]).actual;
    const week5 = workoutAt(plan, 'intervals', 5, [w2]).actual;
    if (week2.kind !== 'intervals' || week5.kind !== 'intervals') throw new Error('Not intervals.');
    expect(week2.count).toBe(4);
    expect([week5.count, week5.distanceM, week5.restS]).toEqual([5, 400, 90]);
    expect(week5.count).toBe(DRAFTS[1]?.count);
  });

  it('uses a later override as the new baseline, with cycle steps counted from its own cycle', () => {
    const w4 = override('intervals', 4, { values: { kind: 'intervals', speedKmh: 17 } });
    expect(labels([w4])).toEqual(['D1@15', 'D2@15', 'D3@15', 'D1@17', 'D2@17', 'D3@17', 'D1@17.5']);
  });

  it('lets a done snapshot of a non-speed edit leave the speed series unchanged', () => {
    const w2 = override('intervals', 2, {
      done: true,
      values: { kind: 'intervals', speedKmh: 15, count: 3, distanceM: 400, restS: 90, warmupKm: 2, cooldownKm: 1.5 },
    });
    expect(labels([w2])).toEqual(labels());
  });

  it('counts the cycle step from the overridden week even when it is the last week of a cycle', () => {
    const w3 = override('intervals', 3, { values: { kind: 'intervals', speedKmh: 14 } });
    expect(labels([w3]).slice(2)).toEqual(['D3@14', 'D1@14.5', 'D2@14.5', 'D3@14.5', 'D1@15']);
  });

  it('keeps float noise out of the speed', () => {
    const noisy = makePlan([intervalsSlot({ startSpeedKmh: 12.1, speedStepKmh: 0.1 })]);
    expect(intervalLabel(workoutAt(noisy, 'intervals', 4))).toBe('D1@12.2');
    expect(intervalLabel(workoutAt(noisy, 'intervals', 7))).toBe('D1@12.3');
  });
});

describe('long horizons', () => {
  it('computes week 200 of an open-ended plan for every slot type', () => {
    const plan = makePlan([squatSlot(), easyRunSlot(), tempoSlot(), intervalsSlot()]);
    expect(strengthLabel(workoutAt(plan, 'lower', 200))).toBe('8@225');
    expect(runKm(workoutAt(plan, 'easy', 200))).toBe(11);
    expect(intervalLabel(workoutAt(plan, 'intervals', 200))).toBe('D2@48');
  });

  it('folds from a late override instead of week 1', () => {
    const logged = override('easy', 190, { done: true, values: { kind: 'run', km: 12 } });
    const plan = makePlan([easyRunSlot()]);
    expect(runKm(workoutAt(plan, 'easy', 191, [logged]))).toBe(6);
    expect(runKm(workoutAt(plan, 'easy', 200, [logged]))).toBe(6 + ((200 - 191) % 7));
  });
});
