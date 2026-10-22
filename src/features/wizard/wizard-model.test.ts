import { createDemoPlan } from '../../domain/demo-plan';
import { planSchema, type Slot } from '../../domain/schema';
import {
  assignLabels,
  canAdvance,
  draftFromPlan,
  duplicateDraft,
  emptyDraft,
  newSlot,
  projectSlot,
  slotIssues,
  slotNames,
  stepIssues,
  suggestWeekday,
  toPlan,
  weeklyCounts,
  weeklyRunningKm,
  type WizardDraft,
} from './wizard-model';

let counter = 0;
const newId = () => `wiz-${++counter}`;

function draftWith(slots: Slot[], changes: Partial<WizardDraft> = {}): WizardDraft {
  return { name: 'Autumn base', startDate: '2026-10-19', endDate: null, slots, ...changes };
}

describe('emptyDraft', () => {
  it('starts in the current week and open-ended', () => {
    expect(emptyDraft('2026-10-22')).toEqual({ name: '', startDate: '2026-10-19', endDate: null, slots: [] });
  });
});

describe('newSlot', () => {
  it('creates a valid slot of every type with a usual weekday', () => {
    const slots: Slot[] = [];
    for (const type of ['lower', 'intervals', 'easy', 'upper', 'tempo', 'long'] as const) {
      slots.push(newSlot(type, slots, newId));
    }
    expect(slots.map((s) => s.defaultWeekday)).toEqual([0, 1, 2, 3, 4, 6]);
    for (const slot of slots) expect(slotIssues(slot).filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('puts a second easy run on the first free day', () => {
    const first = newSlot('easy', [], newId);
    expect(suggestWeekday('easy', [first])).toBe(0);
    const second = newSlot('easy', [first], newId);
    expect(second.defaultWeekday).toBe(0);
  });

  it('leaves the weekday empty when every day is taken', () => {
    const all = ([0, 1, 2, 3, 4, 5, 6] as const).map((day) => ({ ...newSlot('easy', [], newId), defaultWeekday: day }));
    expect(suggestWeekday('long', all)).toBeNull();
  });
});

describe('slot names and labels', () => {
  it('letters duplicated types and leaves single ones plain', () => {
    const slots = [newSlot('easy', [], newId), newSlot('lower', [], newId), newSlot('easy', [], newId)];
    const names = slotNames(slots);
    expect([...names.values()]).toEqual(['Easy run A', 'Lower body', 'Easy run B']);
    expect(assignLabels(slots).map((s) => s.label)).toEqual(['Easy run A', undefined, 'Easy run B']);
  });

  it('drops a stale label when a type is no longer duplicated', () => {
    const lone = { ...newSlot('easy', [], newId), label: 'Easy run B' };
    expect(assignLabels([lone])[0]?.label).toBeUndefined();
  });
});

describe('step validation', () => {
  it('blocks the basics step on a bad date range or an empty name', () => {
    expect(canAdvance(draftWith([], { endDate: '2026-10-12' }), 'basics')).toBe(false);
    expect(canAdvance(draftWith([], { name: ' ' }), 'basics')).toBe(false);
    expect(canAdvance(draftWith([], { endDate: '2026-12-20' }), 'basics')).toBe(true);
  });

  it('requires at least one workout in the structure', () => {
    expect(stepIssues(draftWith([]), 'structure')[0]?.message).toBe('Add at least one workout to the weekly structure.');
    expect(canAdvance(draftWith([newSlot('long', [], newId)]), 'structure')).toBe(true);
  });

  it('warns about unusual run configs without blocking the slots step', () => {
    const slot = newSlot('easy', [], newId);
    if (slot.type !== 'easy') throw new Error('Expected an easy run.');
    const unusual = { ...slot, run: { current: 11, min: 4, max: 9, step: 1 } };
    const issues = stepIssues(draftWith([unusual]), 'slots');
    expect(issues).toEqual([
      {
        field: 'current',
        severity: 'warning',
        message: 'Above max (9 km). Week 1 runs 11 km, then week 2 resets to 4 km.',
      },
    ]);
    expect(canAdvance(draftWith([unusual]), 'slots')).toBe(true);
  });

  it('blocks the slots step for an unnamed exercise or an empty strength slot', () => {
    const strength = newSlot('lower', [], newId);
    if (strength.type !== 'lower') throw new Error('Expected a lower body slot.');
    const unnamed = { ...strength, exercises: strength.exercises.map((e) => ({ ...e, name: '' })) };
    expect(canAdvance(draftWith([unnamed]), 'slots')).toBe(false);
    expect(canAdvance(draftWith([{ ...strength, exercises: [] }]), 'slots')).toBe(false);
  });
});

describe('toPlan', () => {
  it('produces a plan that matches the stored schema', () => {
    const draft = draftWith([newSlot('easy', [], newId), newSlot('easy', [], newId), newSlot('tempo', [], newId)], { name: '  Autumn base ' });
    const plan = toPlan(draft, 'plan-1');
    expect(planSchema.safeParse(plan).success).toBe(true);
    expect(plan.name).toBe('Autumn base');
    expect(plan.endedOn).toBeNull();
    expect(plan.slots.map((s) => s.label)).toEqual(['Easy run A', 'Easy run B', undefined]);
  });

  it('round-trips an existing plan through the draft', () => {
    const plan = createDemoPlan('2026-10-19', newId);
    const rebuilt = toPlan(draftFromPlan(plan), plan.id);
    expect(rebuilt.slots.map((s) => s.id)).toEqual(plan.slots.map((s) => s.id));
    expect(rebuilt.startDate).toBe('2026-10-19');
  });
});

describe('duplicateDraft', () => {
  it('copies a plan with fresh ids, this week as start and no end', () => {
    const plan = { ...createDemoPlan('2026-03-16', newId), endDate: '2026-06-14' };
    const copy = duplicateDraft(plan, '2026-10-22', newId);
    expect(copy.name).toBe('Autumn base (copy)');
    expect(copy.startDate).toBe('2026-10-19');
    expect(copy.endDate).toBeNull();
    expect(copy.slots).toHaveLength(plan.slots.length);
    const oldIds = new Set(plan.slots.flatMap((s) => [s.id, ...(s.type === 'lower' || s.type === 'upper' ? s.exercises.map((e) => e.id) : [])]));
    const newIds = copy.slots.flatMap((s) => [s.id, ...(s.type === 'lower' || s.type === 'upper' ? s.exercises.map((e) => e.id) : [])]);
    expect(newIds.some((id) => oldIds.has(id))).toBe(false);
  });
});

describe('projections', () => {
  it('projects the first 8 weeks of a slot with the real engine', () => {
    const slot = newSlot('easy', [], newId);
    if (slot.type !== 'easy') throw new Error('Expected an easy run.');
    const draft = draftWith([{ ...slot, run: { current: 5, min: 4, max: 9, step: 1 } }]);
    const km = projectSlot(draft, slot.id).map((w) => (w.actual.kind === 'run' ? w.actual.km : NaN));
    expect(km).toEqual([5, 6, 7, 8, 9, 4, 5, 6]);
  });

  it('sums running distance per week and ignores strength', () => {
    const lower = newSlot('lower', [], newId);
    const long = newSlot('long', [lower], newId);
    const tempo = newSlot('tempo', [lower, long], newId);
    const totals = weeklyRunningKm(draftWith([lower, long, tempo]));
    expect(totals).toHaveLength(8);
    expect(totals[0]).toBe(10 + 2 + 3 + 1.5);
    expect(totals[1]).toBe(11 + 2 + 4 + 1.5);
  });

  it('counts strength and running workouts per week', () => {
    expect(weeklyCounts(createDemoPlan('2026-10-19', newId).slots)).toEqual({ strength: 2, running: 5 });
  });
});
