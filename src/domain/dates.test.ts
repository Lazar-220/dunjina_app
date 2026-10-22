import {
  addDays,
  compareDates,
  dateOfWeekday,
  diffDays,
  firstOfMonth,
  formatDate,
  formatDayShort,
  formatMonthTitle,
  monthGrid,
  shiftMonth,
  yearMonthOf,
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

describe('formatDate', () => {
  it('writes weekday, day, month and year', () => {
    expect(formatDate('2026-10-22')).toBe('Thu 22 Oct 2026');
    expect(formatDate('2027-01-03')).toBe('Sun 3 Jan 2027');
  });
});

describe('month helpers', () => {
  it('reads and shifts year-months across year boundaries', () => {
    expect(yearMonthOf('2026-10-22')).toEqual({ year: 2026, month: 10 });
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2026, month: 3 }, -15)).toEqual({ year: 2024, month: 12 });
  });

  it('formats titles and short days', () => {
    expect(formatMonthTitle({ year: 2026, month: 10 })).toBe('October 2026');
    expect(formatDayShort('2026-10-22')).toBe('Thu 22 Oct');
    expect(firstOfMonth({ year: 2026, month: 3 })).toBe('2026-03-01');
  });

  it('builds a Monday-first grid of whole weeks covering the month', () => {
    const october = monthGrid({ year: 2026, month: 10 });
    expect(october).toHaveLength(35);
    expect(october[0]).toBe('2026-09-28');
    expect(october[34]).toBe('2026-11-01');
  });

  it('uses six rows when the month needs them and five when it fits', () => {
    expect(monthGrid({ year: 2026, month: 8 })).toHaveLength(42);
    expect(monthGrid({ year: 2027, month: 2 })).toHaveLength(28);
  });

  it('is stable across the daylight-saving change', () => {
    const grid = monthGrid({ year: 2026, month: 10 });
    expect(grid.indexOf('2026-10-25')).toBe(27);
    expect(new Set(grid).size).toBe(grid.length);
  });
});
