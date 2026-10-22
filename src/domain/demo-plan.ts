import type { IsoDate } from './dates';
import type { ExerciseConfig, Plan, Slot } from './schema';

function exercise(
  newId: () => string,
  name: string,
  reps: { current: number; min: number; max: number },
  kg: { current: number; step: number },
): ExerciseConfig {
  return {
    id: newId(),
    name,
    sets: 3,
    currentReps: reps.current,
    minReps: reps.min,
    maxReps: reps.max,
    repsStep: 2,
    currentKg: kg.current,
    kgStep: kg.step,
  };
}

/** The example plan from the design's review screen: 1 lower, 1 upper, 2 easy runs, 1 tempo, 1 long run, 1 intervals. */
export function createDemoPlan(startDate: IsoDate, newId: () => string): Plan {
  const slots: Slot[] = [
    {
      id: newId(),
      type: 'lower',
      defaultWeekday: 0,
      exercises: [
        exercise(newId, 'Back squat', { current: 6, min: 6, max: 10 }, { current: 60, step: 2.5 }),
        exercise(newId, 'Romanian deadlift', { current: 8, min: 8, max: 12 }, { current: 50, step: 5 }),
        exercise(newId, 'Walking lunge', { current: 8, min: 8, max: 12 }, { current: 14, step: 2 }),
      ],
    },
    {
      id: newId(),
      type: 'intervals',
      defaultWeekday: 1,
      drafts: [
        { count: 8, distanceM: 400, restS: 60 },
        { count: 5, distanceM: 800, restS: 90 },
        { count: 4, distanceM: 1000, restS: 120 },
      ],
      startSpeedKmh: 12,
      speedStepKmh: 0.5,
      warmupKm: 2,
      cooldownKm: 1.5,
    },
    { id: newId(), type: 'easy', label: 'Easy run A', defaultWeekday: 2, run: { current: 5, min: 4, max: 9, step: 1 } },
    {
      id: newId(),
      type: 'upper',
      defaultWeekday: 3,
      exercises: [
        exercise(newId, 'Bench press', { current: 6, min: 6, max: 10 }, { current: 45, step: 2.5 }),
        exercise(newId, 'Barbell row', { current: 8, min: 8, max: 12 }, { current: 40, step: 2.5 }),
        exercise(newId, 'Overhead press', { current: 8, min: 6, max: 10 }, { current: 30, step: 2.5 }),
      ],
    },
    { id: newId(), type: 'easy', label: 'Easy run B', defaultWeekday: 3, run: { current: 4, min: 3, max: 6, step: 1 } },
    {
      id: newId(),
      type: 'tempo',
      defaultWeekday: 4,
      run: { current: 3, min: 2, max: 6, step: 1 },
      warmupKm: 2,
      cooldownKm: 1.5,
    },
    { id: newId(), type: 'long', defaultWeekday: 6, run: { current: 10, min: 8, max: 16, step: 1 } },
  ];
  return { id: newId(), name: 'Autumn base', startDate, endDate: null, endedOn: null, slots };
}
