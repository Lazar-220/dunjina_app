import type { IsoDate } from '../domain/dates';

/** Today's local calendar date. The only place the app reads the clock for plan dates. */
export function todayIso(): IsoDate {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
