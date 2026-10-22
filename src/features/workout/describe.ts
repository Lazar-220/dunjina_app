import { runningKm } from '../../domain/metrics';
import { roundValue } from '../../domain/progression';
import type { WorkoutValues } from '../../domain/schedule';

/** 9, 47.5, 12 - no trailing zeros. */
export const fmt = (value: number): string => String(roundValue(value));

export const fmtSpeed = (kmh: number): string => kmh.toFixed(1);

/** One-line summary shown under a workout's name. */
export function describeValues(values: WorkoutValues): string {
  switch (values.kind) {
    case 'strength': {
      const [first] = values.exercises;
      if (!first) return 'No exercises';
      const more = values.exercises.length - 1;
      return `${first.name} ${first.sets}×${first.reps} @ ${fmt(first.kg)} kg${more > 0 ? ` · +${more} more` : ''}`;
    }
    case 'run':
      return `${fmt(values.km)} km`;
    case 'tempo':
      return `${fmt(values.km)} km tempo · ${fmt(runningKm(values))} km total`;
    case 'intervals':
      return `${values.count} × ${fmt(values.distanceM)} m · ${fmtSpeed(values.speedKmh)} km/h`;
  }
}
