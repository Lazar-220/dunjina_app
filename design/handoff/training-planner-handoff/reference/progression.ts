/**
 * Training Planner — progression engine (reference implementation).
 * Pure functions, no UI, no storage. Weeks are 1-based (week 1 = plan start week).
 *
 * Core idea: nothing generated is stored. Persist only the plan config plus the
 * user's overrides; derive every draft on demand. That gives "infinite" weeks
 * for free (open-ended plans) and makes "reset to generated" = delete overrides.
 */

// ---------- configs ----------
export interface RunConfig { current: number; min: number; max: number; step: number }

export interface ExerciseConfig {
  name: string;
  sets: number;
  currentReps: number;
  minReps: number;
  maxReps: number;
  repsStep: number;
  currentKg: number;
  kgStep: number; // added ONLY in the week reps reset to min
  note?: string;
}

export interface IntervalDraft { count: number; distanceM: number; restS: number }
export interface IntervalConfig {
  drafts: IntervalDraft[]; // D = drafts.length = cycle length in weeks
  startSpeedKmh: number;
  speedStepKmh: number; // applied after each full cycle of D weeks
}

// ---------- overrides (what the user changed / logged), keyed by week ----------
export type RunOverrides = Record<number, number>;                    // km
export type StrengthOverrides = Record<number, { reps: number; kg: number }>; // per exercise
export type SpeedOverrides = Record<number, number>;                  // km/h (propagates)
// Interval count/distance/rest edits are LOCAL to that week: store them on the
// workout instance, never feed them into the series.

// ---------- series ----------
/** Easy run, long run, tempo distance. Final value of week n-1 -> week n. */
export function runSeries(cfg: RunConfig, weeks: number, ov: RunOverrides = {}): number[] {
  const out: number[] = [];
  for (let w = 1; w <= weeks; w++) {
    let v: number;
    if (w === 1) v = cfg.current;
    else {
      const prev = out[w - 2];
      v = prev >= cfg.max ? cfg.min : Math.min(prev + cfg.step, cfg.max);
    }
    if (ov[w] !== undefined) v = ov[w];
    out.push(v);
  }
  return out;
}

/** One strength exercise: [{reps, kg}] per week. */
export function strengthSeries(
  cfg: ExerciseConfig, weeks: number, ov: StrengthOverrides = {},
): { reps: number; kg: number }[] {
  const out: { reps: number; kg: number }[] = [];
  for (let w = 1; w <= weeks; w++) {
    let v: { reps: number; kg: number };
    if (w === 1) v = { reps: cfg.currentReps, kg: cfg.currentKg };
    else {
      const p = out[w - 2];
      v = p.reps >= cfg.maxReps
        ? { reps: cfg.minReps, kg: round(p.kg + cfg.kgStep) }
        : { reps: Math.min(p.reps + cfg.repsStep, cfg.maxReps), kg: p.kg };
    }
    if (ov[w]) v = ov[w];
    out.push(v);
  }
  return out;
}

/** Interval speed per week. Speed steps up after each full cycle of D weeks. */
export function speedSeries(cfg: IntervalConfig, weeks: number, ov: SpeedOverrides = {}): number[] {
  const D = cfg.drafts.length;
  const out: number[] = [];
  for (let w = 1; w <= weeks; w++) {
    let v: number;
    if (w === 1) v = cfg.startSpeedKmh;
    else v = (w - 1) % D === 0 ? round(out[w - 2] + cfg.speedStepKmh) : out[w - 2];
    if (ov[w] !== undefined) v = ov[w];
    out.push(v);
  }
  return out;
}

/** Which template draft (0-based) applies in a given week. Rotates 1..D. */
export const draftIndex = (week: number, D: number) => (week - 1) % D;

// ---------- before/after preview (used by "Mark as done" and inline edit) ----------
export function previewRun(cfg: RunConfig, ov: RunOverrides, week: number, newValue: number, ahead = 3) {
  const before = runSeries(cfg, week + ahead, ov);
  const after = runSeries(cfg, week + ahead, { ...ov, [week]: newValue });
  return rows(week, ahead, before, after, fmt);
}
export function previewStrength(
  cfg: ExerciseConfig, ov: StrengthOverrides, week: number, v: { reps: number; kg: number }, ahead = 3,
) {
  const before = strengthSeries(cfg, week + ahead, ov);
  const after = strengthSeries(cfg, week + ahead, { ...ov, [week]: v });
  return rows(week, ahead, before, after, (x) => `${x.reps}@${x.kg}`);
}
export function previewSpeed(cfg: IntervalConfig, ov: SpeedOverrides, week: number, kmh: number, ahead = 3) {
  const before = speedSeries(cfg, week + ahead, ov);
  const after = speedSeries(cfg, week + ahead, { ...ov, [week]: kmh });
  return rows(week, ahead, before, after, fmt);
}
function rows<T>(week: number, ahead: number, b: T[], a: T[], f: (x: T) => string) {
  return Array.from({ length: ahead }, (_, i) => {
    const w = week + 1 + i;
    return { week: w, before: f(b[w - 1]), after: f(a[w - 1]), changed: f(b[w - 1]) !== f(a[w - 1]) };
  });
}

// ---------- tags shown in the Weeks list ----------
export function runTag(series: number[], cfg: RunConfig, week: number): 'Reset' | 'Max' | '' {
  const v = series[week - 1], p = series[week - 2];
  if (p !== undefined && p >= cfg.max && v === cfg.min) return 'Reset';
  return v === cfg.max ? 'Max' : '';
}

const round = (n: number) => Math.round(n * 100) / 100; // avoid 62.5 + 2.5 float noise
const fmt = (n: number) => String(round(n));
