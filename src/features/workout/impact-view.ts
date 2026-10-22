import type { ImpactRow } from '../../domain/impact';
import type { Workout, WorkoutValues } from '../../domain/schedule';
import { fmt, fmtSpeed } from './describe';

export interface ImpactCell {
  /** "W6" or, for intervals, "W6 · D3". */
  header: string;
  was: string;
  now: string;
  changed: boolean;
}

export interface ImpactGroup {
  label: string;
  cells: ImpactCell[];
}

type Reading = { label: string; text: (values: WorkoutValues) => string };

function readingsOf(sample: WorkoutValues): Reading[] {
  switch (sample.kind) {
    case 'strength':
      return sample.exercises.map((exercise, position) => ({
        label: exercise.name,
        text: (values) => {
          const e = values.kind === 'strength' ? values.exercises[position] : undefined;
          return e ? `${e.reps}@${fmt(e.kg)}` : '–';
        },
      }));
    case 'run':
      return [{ label: 'Distance', text: (v) => (v.kind === 'run' ? `${fmt(v.km)} km` : '–') }];
    case 'tempo':
      return [{ label: 'Tempo distance', text: (v) => (v.kind === 'tempo' ? `${fmt(v.km)} km` : '–') }];
    case 'intervals':
      return [{ label: 'Speed in the next weeks', text: (v) => (v.kind === 'intervals' ? fmtSpeed(v.speedKmh) : '–') }];
  }
}

function headerOf(workout: Workout): string {
  const { actual, week } = workout;
  return actual.kind === 'intervals' ? `W${week} · D${actual.draft}` : `W${week}`;
}

/**
 * The before/after preview shown before saving: one group per exercise (or per measurement),
 * kept only if a following week really changes.
 */
export function impactGroups(rows: readonly ImpactRow[]): ImpactGroup[] {
  const [first] = rows;
  if (!first) return [];
  return readingsOf(first.after.actual)
    .map((reading) => ({
      label: reading.label,
      cells: rows.map((row) => {
        const was = reading.text(row.before.actual);
        const now = reading.text(row.after.actual);
        return { header: headerOf(row.after), was, now, changed: was !== now };
      }),
    }))
    .filter((group) => group.cells.some((cell) => cell.changed));
}
