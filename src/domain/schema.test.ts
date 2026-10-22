import { overrideSchema, planSchema, slotSchema } from './schema';
import { easyRunSlot, intervalsSlot, makePlan, override, squatSlot, tempoSlot } from './test-fixtures';

describe('planSchema', () => {
  it('round-trips a plan with every slot type', () => {
    const plan = makePlan([squatSlot(), easyRunSlot(), tempoSlot(), intervalsSlot()]);
    expect(planSchema.parse(JSON.parse(JSON.stringify(plan)))).toEqual(plan);
  });

  it('rejects an impossible calendar date', () => {
    const result = planSchema.safeParse({ ...makePlan([]), startDate: '2026-02-30' });
    expect(result.success).toBe(false);
  });

  it('rejects a slot type the app does not know', () => {
    expect(slotSchema.safeParse({ ...easyRunSlot(), type: 'swim' }).success).toBe(false);
  });

  it('rejects an intervals slot without drafts', () => {
    expect(slotSchema.safeParse(intervalsSlot({ drafts: [] })).success).toBe(false);
  });

  it('rejects a weekday outside 0-6 and non-finite numbers', () => {
    expect(slotSchema.safeParse({ ...easyRunSlot(), defaultWeekday: 7 }).success).toBe(false);
    expect(slotSchema.safeParse(easyRunSlot({ current: Number.POSITIVE_INFINITY })).success).toBe(false);
  });

  it('accepts configs the progression warns about (min above max, zero step)', () => {
    expect(slotSchema.safeParse(easyRunSlot({ min: 10, max: 6, step: 0 })).success).toBe(true);
  });
});

describe('overrideSchema', () => {
  it('accepts a sparse edit, a done snapshot, a move and a delete', () => {
    expect(overrideSchema.safeParse(override('easy', 2, { values: { kind: 'run' } })).success).toBe(true);
    expect(overrideSchema.safeParse(override('easy', 2, { done: true, values: { kind: 'run', km: 9 } })).success).toBe(true);
    expect(overrideSchema.safeParse(override('easy', 2, { date: '2026-10-30' })).success).toBe(true);
    expect(overrideSchema.safeParse(override('easy', 2, { deleted: true })).success).toBe(true);
  });

  it('rejects week 0 and unknown value kinds', () => {
    expect(overrideSchema.safeParse(override('easy', 0)).success).toBe(false);
    expect(overrideSchema.safeParse({ ...override('easy', 1), values: { kind: 'swim' } }).success).toBe(false);
  });
});
