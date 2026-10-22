import type { OneOffDetails, SlotType } from '../../domain/schema';

/** Starting values for a one-off workout; the user adjusts them when logging it. */
export function defaultOneOffDetails(type: SlotType): OneOffDetails {
  switch (type) {
    case 'lower':
    case 'upper':
      return { kind: 'strength', exercises: [{ name: 'Exercise 1', sets: 3, reps: 8, kg: 20 }] };
    case 'easy':
      return { kind: 'run', km: 5 };
    case 'long':
      return { kind: 'run', km: 10 };
    case 'tempo':
      return { kind: 'tempo', km: 3, warmupKm: 2, cooldownKm: 1.5 };
    case 'intervals':
      return { kind: 'intervals', count: 5, distanceM: 400, restS: 90, speedKmh: 12, warmupKm: 2, cooldownKm: 1.5 };
  }
}
