import {
  computeSlotWeek,
  computeWeek,
  effectiveEndDate,
  indexOverrides,
  lastWeekOf,
  workoutsBetween,
} from './schedule';
import {
  easyRunSlot,
  intervalsSlot,
  makePlan,
  override,
  squatSlot,
  tempoSlot,
  weeks,
  workoutAt,
} from './test-fixtures';

const emptyIndex = indexOverrides([]);

describe('dates of workouts', () => {
  it('places a slot on its default weekday of the plan week', () => {
    const plan = makePlan([squatSlot(), easyRunSlot()]);
    expect(workoutAt(plan, 'lower', 1).date).toBe('2026-10-19');
    expect(workoutAt(plan, 'easy', 1).date).toBe('2026-10-21');
    expect(workoutAt(plan, 'easy', 2).date).toBe('2026-10-28');
  });

  it('leaves a slot without a weekday unassigned', () => {
    const plan = makePlan([easyRunSlot({}, null)]);
    expect(workoutAt(plan, 'easy', 3).date).toBeNull();
  });

  it('moves only the overridden week when the user changes the date', () => {
    const plan = makePlan([easyRunSlot()]);
    const moved = [override('easy', 2, { date: '2026-10-30' })];
    expect(workoutAt(plan, 'easy', 1, moved).date).toBe('2026-10-21');
    expect(workoutAt(plan, 'easy', 2, moved).date).toBe('2026-10-30');
    expect(workoutAt(plan, 'easy', 3, moved).date).toBe('2026-11-04');
  });

  it('does not change progression when a workout is moved', () => {
    const plan = makePlan([easyRunSlot()]);
    const moved = [override('easy', 2, { date: '2026-10-30' })];
    expect(workoutAt(plan, 'easy', 2, moved).actual).toEqual(workoutAt(plan, 'easy', 2).actual);
  });

  it('starts week 1 in the week containing a mid-week start date and clamps earlier slots to the start date', () => {
    const plan = makePlan([squatSlot(), easyRunSlot()], { startDate: '2026-10-21' });
    expect(workoutAt(plan, 'lower', 1).date).toBe('2026-10-21');
    expect(workoutAt(plan, 'easy', 1).date).toBe('2026-10-21');
    expect(workoutAt(plan, 'lower', 2).date).toBe('2026-10-26');
  });

  it('is stable across the autumn daylight-saving change', () => {
    const plan = makePlan([squatSlot(), easyRunSlot({}, 6)]);
    expect(workoutAt(plan, 'easy', 1).date).toBe('2026-10-25');
    expect(workoutAt(plan, 'lower', 2).date).toBe('2026-10-26');
  });
});

describe('status and edited flag', () => {
  const plan = makePlan([easyRunSlot()]);

  it('marks untouched workouts as drafts', () => {
    const workout = workoutAt(plan, 'easy', 2);
    expect([workout.status, workout.edited]).toEqual(['draft', false]);
  });

  it('marks moved or edited workouts as confirmed', () => {
    expect(workoutAt(plan, 'easy', 2, [override('easy', 2, { date: '2026-10-30' })]).status).toBe('confirmed');
    const edited = workoutAt(plan, 'easy', 2, [override('easy', 2, { values: { kind: 'run', km: 7 } })]);
    expect([edited.status, edited.edited]).toEqual(['confirmed', true]);
    expect(edited.planned).toEqual({ kind: 'run', km: 9 });
  });

  it('marks logged workouts as done and edited only when values differ from the plan', () => {
    const same = workoutAt(plan, 'easy', 2, [override('easy', 2, { done: true, values: { kind: 'run', km: 9 } })]);
    expect([same.status, same.edited]).toEqual(['done', false]);
    const changed = workoutAt(plan, 'easy', 2, [override('easy', 2, { done: true, values: { kind: 'run', km: 10 } })]);
    expect([changed.status, changed.edited]).toEqual(['done', true]);
  });

  it('ignores override values of a different kind than the slot', () => {
    const mismatched = override('easy', 2, { values: { kind: 'tempo', km: 99 } });
    expect(workoutAt(plan, 'easy', 2, [mismatched]).actual).toEqual({ kind: 'run', km: 9 });
  });
});

describe('deleting a workout', () => {
  it('removes only that instance and keeps later weeks unchanged', () => {
    const plan = makePlan([easyRunSlot()]);
    const slot = plan.slots[0];
    if (!slot) throw new Error('No slot.');
    const index = indexOverrides([override('easy', 2, { deleted: true })]);
    expect(computeSlotWeek(plan, slot, 2, index)).toBeNull();
    expect(computeSlotWeek(plan, slot, 3, index)?.actual).toEqual({ kind: 'run', km: 10 });
  });

  it('lets the values of a deleted but edited workout keep feeding later weeks', () => {
    const plan = makePlan([easyRunSlot()]);
    const slot = plan.slots[0];
    if (!slot) throw new Error('No slot.');
    const index = indexOverrides([override('easy', 2, { deleted: true, values: { kind: 'run', km: 7 } })]);
    expect(computeSlotWeek(plan, slot, 3, index)?.actual).toEqual({ kind: 'run', km: 8 });
  });
});

describe('plan end', () => {
  it('yields no workouts after the end date', () => {
    const plan = makePlan([squatSlot(), easyRunSlot(), tempoSlot(), intervalsSlot()], { endDate: '2026-11-01' });
    expect(lastWeekOf(plan)).toBe(2);
    expect(computeWeek(plan, 2, emptyIndex)).toHaveLength(4);
    expect(computeWeek(plan, 3, emptyIndex)).toEqual([]);
    expect(computeWeek(plan, 50, emptyIndex)).toEqual([]);
    expect(workoutsBetween(plan, '2026-11-02', '2027-12-31', emptyIndex)).toEqual([]);
  });

  it('drops workouts later in the final week than the end date', () => {
    const plan = makePlan([squatSlot(), easyRunSlot(), tempoSlot()], { endDate: '2026-10-28' });
    const week2 = computeWeek(plan, 2, emptyIndex).map((w) => w.slotId);
    expect(week2).toEqual(['lower', 'easy']);
  });

  it('cuts at the date the plan was ended, whichever is earlier', () => {
    const plan = makePlan([easyRunSlot()], { endDate: '2026-12-31', endedOn: '2026-10-28' });
    expect(effectiveEndDate(plan)).toBe('2026-10-28');
    expect(computeWeek(plan, 3, emptyIndex)).toEqual([]);
  });

  it('drops unassigned workouts of weeks that start after the end date', () => {
    const plan = makePlan([easyRunSlot({}, null)], { endDate: '2026-11-01' });
    expect(computeWeek(plan, 2, emptyIndex)).toHaveLength(1);
    expect(computeWeek(plan, 3, emptyIndex)).toEqual([]);
  });

  it('computes an open-ended plan without a last week', () => {
    const plan = makePlan([easyRunSlot()]);
    expect(lastWeekOf(plan)).toBeNull();
    expect(computeWeek(plan, 200, emptyIndex)).toHaveLength(1);
  });

  it('returns nothing before week 1', () => {
    expect(computeWeek(makePlan([easyRunSlot()]), 0, emptyIndex)).toEqual([]);
  });
});

describe('computeWeek ordering', () => {
  it('orders by date, then slot order, with unassigned workouts last', () => {
    const plan = makePlan([
      easyRunSlot({}, null),
      { ...squatSlot(), id: 'upper', type: 'upper', defaultWeekday: 3 },
      squatSlot({ defaultWeekday: 3 }),
      tempoSlot({ defaultWeekday: 0 }),
    ]);
    expect(computeWeek(plan, 1, emptyIndex).map((w) => w.slotId)).toEqual(['tempo', 'upper', 'lower', 'easy']);
  });
});

describe('workoutsBetween', () => {
  it('returns the workouts dated in the range, across weeks', () => {
    const plan = makePlan([squatSlot(), easyRunSlot()]);
    const result = workoutsBetween(plan, '2026-10-20', '2026-10-28', emptyIndex);
    expect(result.map((w) => [w.slotId, w.date])).toEqual([
      ['easy', '2026-10-21'],
      ['lower', '2026-10-26'],
      ['easy', '2026-10-28'],
    ]);
  });

  it('includes a workout moved into the range from another week', () => {
    const plan = makePlan([easyRunSlot()]);
    const moved = indexOverrides([override('easy', 5, { date: '2026-10-20' })]);
    const result = workoutsBetween(plan, '2026-10-19', '2026-10-25', moved);
    expect(result.map((w) => [w.week, w.date])).toEqual([
      [5, '2026-10-20'],
      [1, '2026-10-21'],
    ]);
  });

  it('leaves out a workout moved out of the range', () => {
    const plan = makePlan([easyRunSlot()]);
    const moved = indexOverrides([override('easy', 1, { date: '2026-11-20' })]);
    expect(workoutsBetween(plan, '2026-10-19', '2026-10-25', moved)).toEqual([]);
  });

  it('computes a range far in the future', () => {
    const plan = makePlan([easyRunSlot()]);
    const result = workoutsBetween(plan, '2030-01-01', '2030-01-31', emptyIndex);
    expect(result.length).toBeGreaterThanOrEqual(4);
    expect(weeks(1, 1)).toEqual([1]);
  });
});
