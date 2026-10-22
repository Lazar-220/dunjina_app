import type { Override, Plan, Slot } from './schema';
import { computeSlotWeek, type OverrideIndex, type Workout, withOverride } from './schedule';

export const DEFAULT_PREVIEW_WEEKS = 3;

export interface ImpactRow {
  week: number;
  before: Workout;
  after: Workout;
  /** True when the candidate override changes the actual values of this later week. */
  changed: boolean;
}

/**
 * Before/after view of the weeks following `week` if `candidate` were saved.
 * Weeks that do not exist (deleted, past the plan end) are skipped.
 */
export function previewImpact(
  plan: Plan,
  slot: Slot,
  candidate: Override,
  index: OverrideIndex,
  weeksAhead: number = DEFAULT_PREVIEW_WEEKS,
): ImpactRow[] {
  const candidateIndex = withOverride(index, candidate);
  const rows: ImpactRow[] = [];
  for (let week = candidate.week + 1; week <= candidate.week + weeksAhead; week++) {
    const before = computeSlotWeek(plan, slot, week, index);
    const after = computeSlotWeek(plan, slot, week, candidateIndex);
    if (before && after) {
      rows.push({ week, before, after, changed: JSON.stringify(before.actual) !== JSON.stringify(after.actual) });
    }
  }
  return rows;
}
