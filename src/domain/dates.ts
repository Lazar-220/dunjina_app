/**
 * Local calendar dates as "YYYY-MM-DD" strings. All arithmetic runs on UTC day numbers,
 * so daylight-saving changes in the user's time zone can never shift a date.
 */
export type IsoDate = string;

/** 0 = Monday ... 6 = Sunday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const MS_PER_DAY = 86_400_000;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
/** 1970-01-01 was a Thursday, which is weekday index 3. */
const EPOCH_WEEKDAY = 3;

export function isValidIsoDate(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}

function toDayNumber(date: IsoDate): number {
  const match = ISO_DATE_PATTERN.exec(date);
  if (!match || !isValidIsoDate(date)) {
    throw new RangeError(`Not a valid calendar date: "${date}". Expected YYYY-MM-DD.`);
  }
  return Math.round(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / MS_PER_DAY);
}

function fromDayNumber(dayNumber: number): IsoDate {
  const utc = new Date(dayNumber * MS_PER_DAY);
  const year = String(utc.getUTCFullYear()).padStart(4, '0');
  const month = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utc.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromDayNumber(toDayNumber(date) + days);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function diffDays(from: IsoDate, to: IsoDate): number {
  return toDayNumber(to) - toDayNumber(from);
}

export function weekdayOf(date: IsoDate): Weekday {
  return ((((toDayNumber(date) + EPOCH_WEEKDAY) % 7) + 7) % 7) as Weekday;
}

export function mondayOf(date: IsoDate): IsoDate {
  return addDays(date, -weekdayOf(date));
}

/** 1-based plan week containing `date`; week 1 contains `planStart`. Values below 1 mean "before the plan". */
export function weekIndexOf(planStart: IsoDate, date: IsoDate): number {
  return Math.floor(diffDays(mondayOf(planStart), date) / 7) + 1;
}

/** The Monday that starts plan week `week`. */
export function weekStartDate(planStart: IsoDate, week: number): IsoDate {
  return addDays(mondayOf(planStart), 7 * (week - 1));
}

export function dateOfWeekday(planStart: IsoDate, week: number, weekday: Weekday): IsoDate {
  return addDays(weekStartDate(planStart, week), weekday);
}

export function compareDates(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Thu 22 Oct 2026" */
export function formatDate(date: IsoDate): string {
  const [year, month, day] = date.split('-').map(Number);
  return `${WEEKDAY_NAMES[weekdayOf(date)]} ${day} ${MONTH_NAMES[(month ?? 1) - 1]} ${year}`;
}
