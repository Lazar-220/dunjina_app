import {
  addDays,
  compareDates,
  dateOfWeekday,
  diffDays,
  isValidIsoDate,
  mondayOf,
  weekdayOf,
  weekIndexOf,
  weekStartDate,
} from './dates';

describe('test environment', () => {
  it('runs in a time zone with daylight-saving changes (Europe/Belgrade)', () => {
    const before = new Date(2026, 9, 25, 0, 0, 0).getTime();
    const after = new Date(2026, 9, 26, 0, 0, 0).getTime();
    expect((after - before) / 3_600_000).toBe(25);
  });
});

describe('weekdayOf and mondayOf', () => {
  it('numbers weekdays from Monday = 0', () => {
    expect(weekdayOf('2026-10-19')).toBe(0);
    expect(weekdayOf('2026-10-22')).toBe(3);
    expect(weekdayOf('2026-10-25')).toBe(6);
  });

  it('returns the Monday of the containing week', () => {
    expect(mondayOf('2026-10-19')).toBe('2026-10-19');
    expect(mondayOf('2026-10-25')).toBe('2026-10-19');
    expect(mondayOf('2026-10-26')).toBe('2026-10-26');
  });
});

describe('addDays and diffDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('measures whole days', () => {
    expect(diffDays('2026-10-19', '2026-10-26')).toBe(7);
    expect(diffDays('2026-10-26', '2026-10-19')).toBe(-7);
  });
});

describe('daylight-saving transitions in Europe/Belgrade', () => {
  it('addDays across the autumn change (2026-10-25, 25-hour day) moves exactly one calendar day', () => {
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addDays('2026-10-23', 7)).toBe('2026-10-30');
    expect(diffDays('2026-10-24', '2026-10-26')).toBe(2);
  });

  it('addDays across the spring change (2026-03-29, 23-hour day) moves exactly one calendar day', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-03-27', 7)).toBe('2026-04-03');
    expect(diffDays('2026-03-28', '2026-03-30')).toBe(2);
  });

  it('mondayOf is unaffected by the changes', () => {
    expect(mondayOf('2026-10-25')).toBe('2026-10-19');
    expect(mondayOf('2026-10-26')).toBe('2026-10-26');
    expect(mondayOf('2026-03-29')).toBe('2026-03-23');
    expect(mondayOf('2026-03-30')).toBe('2026-03-30');
  });

  it('weekIndexOf counts weeks across the changes', () => {
    expect(weekIndexOf('2026-10-19', '2026-10-24')).toBe(1);
    expect(weekIndexOf('2026-10-19', '2026-10-25')).toBe(1);
    expect(weekIndexOf('2026-10-19', '2026-10-26')).toBe(2);
    expect(weekIndexOf('2026-03-23', '2026-03-29')).toBe(1);
    expect(weekIndexOf('2026-03-23', '2026-03-30')).toBe(2);
    expect(weekIndexOf('2026-03-16', '2026-04-05')).toBe(3);
  });

  it('weekStartDate and dateOfWeekday agree with weekIndexOf over the changes', () => {
    expect(weekStartDate('2026-10-19', 2)).toBe('2026-10-26');
    expect(dateOfWeekday('2026-10-19', 1, 6)).toBe('2026-10-25');
    expect(dateOfWeekday('2026-03-23', 1, 6)).toBe('2026-03-29');
    expect(weekStartDate('2026-03-23', 2)).toBe('2026-03-30');
  });
});

describe('weekIndexOf and weekStartDate', () => {
  it('uses the week containing the start date as week 1, even mid-week', () => {
    expect(weekIndexOf('2026-10-22', '2026-10-22')).toBe(1);
    expect(weekIndexOf('2026-10-22', '2026-10-19')).toBe(1);
    expect(weekIndexOf('2026-10-22', '2026-10-26')).toBe(2);
    expect(weekStartDate('2026-10-22', 1)).toBe('2026-10-19');
  });

  it('returns values below 1 for dates before the plan', () => {
    expect(weekIndexOf('2026-10-19', '2026-10-18')).toBe(0);
    expect(weekIndexOf('2026-10-19', '2026-10-12')).toBe(0);
    expect(weekIndexOf('2026-10-19', '2026-10-11')).toBe(-1);
  });
});

describe('isValidIsoDate and compareDates', () => {
  it('accepts real calendar dates only', () => {
    expect(isValidIsoDate('2026-10-25')).toBe(true);
    expect(isValidIsoDate('2028-02-29')).toBe(true);
    expect(isValidIsoDate('2026-02-29')).toBe(false);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('2026-1-1')).toBe(false);
    expect(isValidIsoDate('not a date')).toBe(false);
  });

  it('throws a clear error on invalid input', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow('Not a valid calendar date');
  });

  it('orders ISO dates', () => {
    expect(compareDates('2026-10-24', '2026-10-25')).toBe(-1);
    expect(compareDates('2026-10-25', '2026-10-25')).toBe(0);
    expect(compareDates('2026-10-26', '2026-10-25')).toBe(1);
  });
});
