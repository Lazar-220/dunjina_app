import { indexOverrides } from '../../domain/schedule';
import { easyRunSlot, intervalsSlot, makePlan, override, squatSlot, tempoSlot, workoutAt } from '../../domain/test-fixtures';
import { followNote, progressionTag, rangeLabel, summarizeWeek, trendOf } from './weeks-model';

const plan = makePlan([squatSlot(), easyRunSlot({ current: 8, min: 6, max: 12, step: 1 }), tempoSlot(), intervalsSlot()]);
const slot = (id: string) => {
  const found = plan.slots.find((s) => s.id === id);
  if (!found) throw new Error(`No slot ${id}`);
  return found;
};

describe('summarizeWeek', () => {
  it('lists the week, its date range and the running distance', () => {
    const summary = summarizeWeek(plan, 1, indexOverrides([]), []);
    expect(summary.start).toBe('2026-10-19');
    expect(summary.end).toBe('2026-10-25');
    expect(summary.workouts).toHaveLength(4);
    expect(summary.runningKm).toBeCloseTo(19.8, 5);
    expect(summary.statusLine).toBe('4 workouts');
    expect(rangeLabel(summary.start, summary.end)).toBe('19 Oct – 25 Oct');
  });

  it('counts done and edited workouts and offers a reset for edits only', () => {
    const overrides = [
      override('easy', 1, { done: true, values: { kind: 'run', km: 8 } }),
      override('tempo', 1, { values: { kind: 'tempo', km: 5 } }),
      override('intervals', 1, { date: '2026-10-24' }),
      override('easy', 2, { values: { kind: 'run', km: 7 } }),
    ];
    const summary = summarizeWeek(plan, 1, indexOverrides(overrides), overrides);
    expect(summary.statusLine).toBe('1 of 4 done · 2 edited');
    expect(summary.done.map((w) => w.slotId)).toEqual(['easy']);
    expect(summary.open).toHaveLength(3);
    expect(summary.resettable.map((k) => k.slotId).sort()).toEqual(['intervals', 'tempo']);
  });

  it('includes a deleted workout in the reset targets', () => {
    const overrides = [override('easy', 1, { deleted: true })];
    const summary = summarizeWeek(plan, 1, indexOverrides(overrides), overrides);
    expect(summary.workouts).toHaveLength(3);
    expect(summary.resettable).toEqual([{ planId: 'plan-1', slotId: 'easy', week: 1 }]);
  });
});

describe('progressionTag', () => {
  const index = indexOverrides([]);
  it('tags a run that reaches max and the week after it', () => {
    const tag = (week: number) => progressionTag(plan, slot('easy'), workoutAt(plan, 'easy', week), index);
    expect([tag(4), tag(5), tag(6), tag(7)]).toEqual(['', 'Max', 'Reset', '']);
  });

  it('tags the week the weight steps up', () => {
    const tag = (week: number) => progressionTag(plan, slot('lower'), workoutAt(plan, 'lower', week), index);
    expect([tag(3), tag(4), tag(5)]).toEqual(['', 'Weight step', '']);
  });

  it('tags the week the interval speed steps up', () => {
    const tag = (week: number) => progressionTag(plan, slot('intervals'), workoutAt(plan, 'intervals', week), index);
    expect([tag(3), tag(4)]).toEqual(['', 'Speed +0.5']);
  });
});

describe('followNote', () => {
  it('explains that an untouched week follows an earlier speed edit', () => {
    const overrides = [override('intervals', 5, { values: { kind: 'intervals', speedKmh: 12 } })];
    const w6 = workoutAt(plan, 'intervals', 6, overrides);
    expect(followNote(plan, slot('intervals'), w6, overrides)).toBe('Follows your W5 edit · plan 15.5 km/h');
  });

  it('says nothing for the edited week itself or for untouched series', () => {
    const overrides = [override('easy', 3, { values: { kind: 'run', km: 7 } })];
    expect(followNote(plan, slot('easy'), workoutAt(plan, 'easy', 3, overrides), overrides)).toBeNull();
    expect(followNote(plan, slot('lower'), workoutAt(plan, 'lower', 4, overrides), overrides)).toBeNull();
  });
});

describe('trendOf', () => {
  it('returns the neighbouring weeks with this week in position', () => {
    const trend = trendOf(plan, slot('easy'), 5, indexOverrides([]));
    expect(trend.values).toEqual([9, 10, 11, 12, 6, 7, 8, 9].slice(0, trend.values.length));
    expect(trend.values[trend.currentIndex]).toBe(12);
  });

  it('starts at week 1 for early weeks', () => {
    const trend = trendOf(plan, slot('easy'), 1, indexOverrides([]));
    expect(trend.currentIndex).toBe(0);
    expect(trend.values).toHaveLength(5);
  });
});
