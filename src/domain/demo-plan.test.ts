import { createDemoPlan } from './demo-plan';
import { planSchema } from './schema';
import { computeWeek, indexOverrides } from './schedule';

let counter = 0;
const newId = () => `id-${++counter}`;

describe('createDemoPlan', () => {
  const plan = createDemoPlan('2026-10-19', newId);

  it('is a valid open-ended plan', () => {
    expect(planSchema.safeParse(plan).success).toBe(true);
    expect(plan.endDate).toBeNull();
  });

  it('has 1 lower, 1 upper, 2 easy runs, 1 tempo, 1 long run and 1 intervals slot', () => {
    const counts = new Map<string, number>();
    for (const slot of plan.slots) counts.set(slot.type, (counts.get(slot.type) ?? 0) + 1);
    expect(Object.fromEntries(counts)).toEqual({ lower: 1, upper: 1, easy: 2, tempo: 1, long: 1, intervals: 1 });
  });

  it('uses unique ids', () => {
    const ids = [plan.id, ...plan.slots.map((slot) => slot.id)];
    for (const slot of plan.slots) {
      if (slot.type === 'lower' || slot.type === 'upper') ids.push(...slot.exercises.map((e) => e.id));
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('puts seven workouts in every week', () => {
    expect(computeWeek(plan, 1, indexOverrides([]))).toHaveLength(7);
    expect(computeWeek(plan, 40, indexOverrides([]))).toHaveLength(7);
  });
});
