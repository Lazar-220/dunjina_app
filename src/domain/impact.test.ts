import { previewImpact } from './impact';
import { indexOverrides } from './schedule';
import { easyRunSlot, intervalsSlot, makePlan, override, squatSlot } from './test-fixtures';
import type { Workout } from './schedule';

function strengthText(workout: Workout): string {
  if (workout.actual.kind !== 'strength') throw new Error('Not strength.');
  return workout.actual.exercises.map((e) => `${e.reps}@${e.kg}`).join(',');
}

describe('previewImpact', () => {
  it('shows before and after for the next 3 weeks when a strength value changes', () => {
    const slot = squatSlot();
    const plan = makePlan([slot]);
    const candidate = override('lower', 4, {
      done: true,
      values: { kind: 'strength', exercises: [{ exerciseId: 'squat', sets: 3, reps: 6, kg: 60 }] },
    });
    const rows = previewImpact(plan, slot, candidate, indexOverrides([]));
    expect(rows.map((r) => [r.week, strengthText(r.before), strengthText(r.after), r.changed])).toEqual([
      [5, '8@62.5', '8@60', true],
      [6, '10@62.5', '10@60', true],
      [7, '6@65', '6@62.5', true],
    ]);
  });

  it('reports no change when the logged values match the plan', () => {
    const slot = easyRunSlot();
    const plan = makePlan([slot]);
    const candidate = override('easy', 2, { done: true, values: { kind: 'run', km: 9 } });
    const rows = previewImpact(plan, slot, candidate, indexOverrides([]));
    expect(rows.map((r) => r.changed)).toEqual([false, false, false]);
  });

  it('previews a speed change for intervals, rebased on the edited speed', () => {
    const slot = intervalsSlot();
    const plan = makePlan([slot]);
    const candidate = override('intervals', 2, { values: { kind: 'intervals', speedKmh: 14 } });
    const rows = previewImpact(plan, slot, candidate, indexOverrides([]));
    expect(
      rows.map((r) => [
        r.week,
        r.before.actual.kind === 'intervals' ? r.before.actual.speedKmh : null,
        r.after.actual.kind === 'intervals' ? r.after.actual.speedKmh : null,
      ]),
    ).toEqual([
      [3, 15, 14],
      [4, 15.5, 14.5],
      [5, 15.5, 14.5],
    ]);
  });

  it('does not mark later weeks as changed when only session-local interval fields change', () => {
    const slot = intervalsSlot();
    const plan = makePlan([slot]);
    const candidate = override('intervals', 2, { values: { kind: 'intervals', count: 4 } });
    const rows = previewImpact(plan, slot, candidate, indexOverrides([]));
    expect(rows.every((r) => !r.changed)).toBe(true);
  });

  it('respects existing overrides in the "before" column', () => {
    const slot = easyRunSlot();
    const plan = makePlan([slot]);
    const existing = indexOverrides([override('easy', 1, { values: { kind: 'run', km: 7 } })]);
    const candidate = override('easy', 2, { values: { kind: 'run', km: 7 } });
    const rows = previewImpact(plan, slot, candidate, existing);
    expect(rows[0]?.before.actual).toEqual({ kind: 'run', km: 9 });
    expect(rows[0]?.after.actual).toEqual({ kind: 'run', km: 8 });
  });

  it('stops at the end of the plan', () => {
    const slot = easyRunSlot();
    const plan = makePlan([slot], { endDate: '2026-11-01' });
    const candidate = override('easy', 2, { values: { kind: 'run', km: 7 } });
    expect(previewImpact(plan, slot, candidate, indexOverrides([]))).toEqual([]);
  });
});
