import { runningKm } from '../../domain/metrics';
import type { RunConfig } from '../../domain/schema';
import type { Workout } from '../../domain/schedule';
import { fmt, fmtSpeed } from '../workout/describe';

export interface SeriesCell {
  week: string;
  main: string;
  sub?: string;
  /** True where the value resets or steps up. */
  mark: boolean;
}

export interface Series {
  /** The plotted value per week. */
  values: number[];
  marks: boolean[];
  cells: SeriesCell[];
}

interface Reading {
  /** Plotted value. */
  value: number;
  /** A second number that decides marks when the plotted value does not (the weight of a lift). */
  weight?: number;
  main: string;
  sub?: string;
}

function build(
  workouts: readonly Workout[],
  read: (workout: Workout) => Reading,
  isMark: (current: Reading, previous: Reading) => boolean,
): Series {
  const readings = workouts.map(read);
  const marks = readings.map((reading, i) => {
    const previous = readings[i - 1];
    return previous !== undefined && isMark(reading, previous);
  });
  return {
    values: readings.map((r) => r.value),
    marks,
    cells: readings.map((r, i) => ({
      week: `W${workouts[i]?.week ?? i + 1}`,
      main: r.main,
      ...(r.sub !== undefined && { sub: r.sub }),
      mark: marks[i] ?? false,
    })),
  };
}

/** Distance of an easy, long or tempo slot; a mark is the week it resets to min after reaching max. */
export function runSeries(workouts: readonly Workout[], config: RunConfig): Series {
  return build(
    workouts,
    ({ actual }) => {
      const km = actual.kind === 'run' || actual.kind === 'tempo' ? actual.km : 0;
      return { value: km, main: fmt(km) };
    },
    (current, previous) => previous.value >= config.max && current.value === config.min,
  );
}

/** Reps by week with the weight underneath; a mark is a week where the weight steps up. */
export function strengthSeries(workouts: readonly Workout[], exerciseId: string): Series {
  return build(
    workouts,
    ({ actual }) => {
      const exercise = actual.kind === 'strength' ? actual.exercises.find((e) => e.exerciseId === exerciseId) : undefined;
      const reps = exercise?.reps ?? 0;
      const kg = exercise?.kg ?? 0;
      return { value: reps, weight: kg, main: String(reps), sub: fmt(kg) };
    },
    (current, previous) => (current.weight ?? 0) > (previous.weight ?? 0),
  );
}

/** Interval speed with the draft of the week; a mark is a week where the speed steps up. */
export function speedSeries(workouts: readonly Workout[]): Series {
  return build(
    workouts,
    ({ actual }) => {
      if (actual.kind !== 'intervals') return { value: 0, main: '–' };
      return { value: actual.speedKmh, main: `D${actual.draft}`, sub: fmtSpeed(actual.speedKmh) };
    },
    (current, previous) => current.value > previous.value,
  );
}

export interface TempoColumn {
  week: string;
  total: number;
  warmup: number;
  tempo: number;
  cooldown: number;
}

/** Warm-up, tempo and cool-down distance per week, for the stacked bars. */
export function tempoColumns(workouts: readonly Workout[]): TempoColumn[] {
  return workouts.map(({ week, actual }) => {
    if (actual.kind !== 'tempo') return { week: `W${week}`, total: 0, warmup: 0, tempo: 0, cooldown: 0 };
    return { week: `W${week}`, total: runningKm(actual), warmup: actual.warmupKm, tempo: actual.km, cooldown: actual.cooldownKm };
  });
}
