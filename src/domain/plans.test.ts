import { findActivePlan, isPlanActive } from './plans';
import { makePlan } from './test-fixtures';

describe('isPlanActive', () => {
  it('keeps an open-ended plan active', () => {
    expect(isPlanActive(makePlan([]), '2030-01-01')).toBe(true);
  });

  it('stays active through its end date and stops the day after', () => {
    const plan = makePlan([], { endDate: '2026-12-20' });
    expect(isPlanActive(plan, '2026-12-20')).toBe(true);
    expect(isPlanActive(plan, '2026-12-21')).toBe(false);
  });

  it('is not active once the user ended it', () => {
    expect(isPlanActive(makePlan([], { endedOn: '2026-10-20' }), '2026-10-20')).toBe(false);
  });
});

describe('findActivePlan', () => {
  it('returns the active plan among ended ones', () => {
    const ended = makePlan([], { id: 'old', endedOn: '2026-05-01' });
    const current = makePlan([], { id: 'current' });
    expect(findActivePlan([ended, current], '2026-10-22')?.id).toBe('current');
    expect(findActivePlan([ended], '2026-10-22')).toBeUndefined();
  });
});
