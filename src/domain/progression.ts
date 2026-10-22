import type { ExerciseConfig, RunConfig } from './schema';

/** Rounds away float noise after additions (62.5 + 2.5, 15 + 0.5). */
export function roundValue(value: number): number {
  return Math.round(value * 1000) / 1000;
}

// ---------- runs: easy, long, tempo distance ----------

export function nextRunKm(previousKm: number, config: RunConfig): number {
  return previousKm >= config.max ? config.min : roundValue(Math.min(previousKm + config.step, config.max));
}

/**
 * Final km of `week`: the override if present, otherwise the step from the previous week's final value.
 * Folds forward from the nearest override at or before `week`.
 */
export function finalRunKm(config: RunConfig, week: number, overrideKm: (week: number) => number | undefined): number {
  let start = week;
  while (start > 1 && overrideKm(start) === undefined) start--;
  let km = overrideKm(start) ?? config.current;
  for (let w = start + 1; w <= week; w++) km = nextRunKm(km, config);
  return km;
}

export function plannedRunKm(config: RunConfig, week: number, overrideKm: (week: number) => number | undefined): number {
  return week <= 1 ? config.current : nextRunKm(finalRunKm(config, week - 1, overrideKm), config);
}

// ---------- strength: reps and weight per exercise ----------

export interface RepsAndWeight {
  reps: number;
  kg: number;
}

/** Fields the user changed in one week; a missing field follows the generated value. */
export type PartialRepsAndWeight = Partial<RepsAndWeight>;

export function nextStrength(previous: RepsAndWeight, config: ExerciseConfig): RepsAndWeight {
  if (previous.reps >= config.maxReps) {
    return { reps: config.minReps, kg: roundValue(previous.kg + config.kgStep) };
  }
  return { reps: roundValue(Math.min(previous.reps + config.repsStep, config.maxReps)), kg: previous.kg };
}

function applyPartial(base: RepsAndWeight, partial: PartialRepsAndWeight | undefined): RepsAndWeight {
  return { reps: partial?.reps ?? base.reps, kg: partial?.kg ?? base.kg };
}

/**
 * Final reps and weight of `week`. A fully specified override (a done snapshot) is a clean baseline;
 * partial overrides are merged on top of the generated value of their own week.
 */
export function finalStrength(
  config: ExerciseConfig,
  week: number,
  overrideAt: (week: number) => PartialRepsAndWeight | undefined,
): RepsAndWeight {
  const isComplete = (w: number) => {
    const partial = overrideAt(w);
    return partial?.reps !== undefined && partial.kg !== undefined;
  };
  let start = week;
  while (start > 1 && !isComplete(start)) start--;
  let value = applyPartial({ reps: config.currentReps, kg: config.currentKg }, overrideAt(start));
  for (let w = start + 1; w <= week; w++) value = applyPartial(nextStrength(value, config), overrideAt(w));
  return value;
}

export function plannedStrength(
  config: ExerciseConfig,
  week: number,
  overrideAt: (week: number) => PartialRepsAndWeight | undefined,
): RepsAndWeight {
  return week <= 1
    ? { reps: config.currentReps, kg: config.currentKg }
    : nextStrength(finalStrength(config, week - 1, overrideAt), config);
}

// ---------- intervals: rotating drafts, stepping speed ----------

export interface SpeedConfig {
  startSpeedKmh: number;
  speedStepKmh: number;
  cycleLength: number;
}

/** 0-based index of the draft used in `week`; drafts rotate 1..D. */
export function draftIndexOf(week: number, cycleLength: number): number {
  return (week - 1) % cycleLength;
}

function cycleOf(week: number, cycleLength: number): number {
  return Math.floor((week - 1) / cycleLength);
}

/**
 * Speed planned for `week`: the start speed plus one step per full cycle, rebased on the nearest
 * override strictly before `week` (an overridden speed carries forward, cycle steps still apply).
 */
export function plannedSpeed(config: SpeedConfig, week: number, overrideSpeed: (week: number) => number | undefined): number {
  let baseWeek = week - 1;
  while (baseWeek >= 1 && overrideSpeed(baseWeek) === undefined) baseWeek--;
  const baseSpeed = baseWeek >= 1 ? overrideSpeed(baseWeek) : undefined;
  if (baseWeek < 1 || baseSpeed === undefined) {
    return roundValue(config.startSpeedKmh + config.speedStepKmh * cycleOf(week, config.cycleLength));
  }
  const cyclesSinceBase = cycleOf(week, config.cycleLength) - cycleOf(baseWeek, config.cycleLength);
  return roundValue(baseSpeed + config.speedStepKmh * cyclesSinceBase);
}

export function finalSpeed(config: SpeedConfig, week: number, overrideSpeed: (week: number) => number | undefined): number {
  return overrideSpeed(week) ?? plannedSpeed(config, week, overrideSpeed);
}
