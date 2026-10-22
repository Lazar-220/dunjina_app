import { createDemoPlan } from '../../domain/demo-plan';
import { indexOverrides } from '../../domain/schedule';
import type { Override } from '../../domain/schema';
import { describePlan, draftsRemovedThisWeek, sortPlans } from './plans-model';

let counter = 0;
const newId = () => `plans-${++counter}`;

describe('describePlan', () => {
  it('describes an open-ended active plan', () => {
    const plan = createDemoPlan('2026-09-21', newId);
    expect(describePlan(plan, '2026-10-22', [])).toEqual({
      status: 'active',
      span: 'Open-ended · since Mon 21 Sep 2026',
      detail: 'Now in week 5 · 7 workouts a week',
      strength: 2,
      running: 5,
    });
  });

  it('describes a plan with an end date by its span and weeks', () => {
    const plan = { ...createDemoPlan('2026-10-19', newId), endDate: '2026-12-13' };
    const described = describePlan(plan, '2026-10-22', []);
    expect(described.span).toBe('Mon 19 Oct 2026 – Sun 13 Dec 2026 · 8 weeks');
    expect(described.status).toBe('active');
  });

  it('says when a plan has not started yet', () => {
    const plan = createDemoPlan('2026-11-02', newId);
    expect(describePlan(plan, '2026-10-22', []).detail).toBe('Starts in 2 weeks · 7 workouts a week');
  });

  it('describes an ended plan by its completed workouts', () => {
    const plan = { ...createDemoPlan('2026-03-16', newId), endedOn: '2026-06-14' };
    const overrides: Override[] = [
      { planId: plan.id, slotId: 'a', week: 1, done: true },
      { planId: plan.id, slotId: 'a', week: 2, done: true },
      { planId: plan.id, slotId: 'a', week: 3, values: { kind: 'run', km: 5 } },
      { planId: 'other', slotId: 'a', week: 1, done: true },
    ];
    expect(describePlan(plan, '2026-10-22', overrides)).toMatchObject({
      status: 'ended',
      span: 'Mon 16 Mar 2026 – Sun 14 Jun 2026 · 13 weeks',
      detail: '2 workouts completed',
    });
  });
});

describe('sortPlans', () => {
  it('puts the active plan first and the rest newest first', () => {
    const old = { ...createDemoPlan('2026-01-05', newId), endedOn: '2026-02-01' };
    const newer = { ...createDemoPlan('2026-03-16', newId), endedOn: '2026-06-14' };
    const active = createDemoPlan('2026-09-21', newId);
    expect(sortPlans([old, active, newer], '2026-10-22').map((p) => p.startDate)).toEqual(['2026-09-21', '2026-03-16', '2026-01-05']);
  });
});

describe('draftsRemovedThisWeek', () => {
  const plan = createDemoPlan('2026-10-19', newId);
  const index = indexOverrides([]);

  it('counts the open workouts after the end date in the current week', () => {
    // Thu 22 Oct: Fri tempo and Sun long run remain (Thu's two are on the end date).
    expect(draftsRemovedThisWeek(plan, index, '2026-10-22', '2026-10-22')).toBe(2);
  });

  it('does not count done workouts', () => {
    const long = plan.slots.find((s) => s.type === 'long');
    if (!long) throw new Error('No long run.');
    const withDone = indexOverrides([{ planId: plan.id, slotId: long.id, week: 1, done: true }]);
    expect(draftsRemovedThisWeek(plan, withDone, '2026-10-22', '2026-10-22')).toBe(1);
  });

  it('is zero when the end date is on or after the end of the week', () => {
    expect(draftsRemovedThisWeek(plan, index, '2026-10-25', '2026-10-22')).toBe(0);
    expect(draftsRemovedThisWeek(plan, index, '2026-11-30', '2026-10-22')).toBe(0);
  });
});
