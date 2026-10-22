import { roundValue } from './progression';
import type { WorkoutValues } from './schedule';

/** Distance run in one session, warm-up and cool-down included; 0 for strength workouts. */
export function runningKm(values: WorkoutValues): number {
  switch (values.kind) {
    case 'strength':
      return 0;
    case 'run':
      return values.km;
    case 'tempo':
      return roundValue(values.warmupKm + values.km + values.cooldownKm);
    case 'intervals':
      return roundValue(values.warmupKm + (values.count * values.distanceM) / 1000 + values.cooldownKm);
  }
}
