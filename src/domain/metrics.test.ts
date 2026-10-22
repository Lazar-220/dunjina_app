import { runningKm } from './metrics';

describe('runningKm', () => {
  it('counts every running distance and nothing for strength', () => {
    expect(runningKm({ kind: 'strength', exercises: [] })).toBe(0);
    expect(runningKm({ kind: 'run', km: 9 })).toBe(9);
    expect(runningKm({ kind: 'tempo', km: 3, warmupKm: 2, cooldownKm: 1.5 })).toBe(6.5);
  });

  it('adds repetition distance to warm-up and cool-down for intervals', () => {
    const intervals = {
      kind: 'intervals' as const,
      draft: 1,
      draftCount: 3,
      count: 8,
      distanceM: 400,
      restS: 60,
      speedKmh: 12,
      warmupKm: 2,
      cooldownKm: 1.5,
    };
    expect(runningKm(intervals)).toBe(6.7);
  });
});
