// Run: npx tsx reference/progression.test.ts   (or port to vitest — plain asserts on purpose)
import assert from 'node:assert/strict';
import {
  runSeries, strengthSeries, speedSeries, draftIndex, previewRun, previewStrength, previewSpeed,
  type ExerciseConfig, type IntervalConfig,
} from './progression';

const squat: ExerciseConfig = { name: 'Squat', sets: 3, currentReps: 6, minReps: 6, maxReps: 10, repsStep: 2, currentKg: 60, kgStep: 2.5 };
const at = (s: { reps: number; kg: number }[]) => s.map((x) => `${x.reps}@${x.kg}`).join(' ');

// Strength, spec example
assert.equal(at(strengthSeries(squat, 7)), '6@60 8@60 10@60 6@62.5 8@62.5 10@62.5 6@65');
// User logs W4 as 6@60 -> everything after shifts from the edited value
assert.equal(at(strengthSeries(squat, 7, { 4: { reps: 6, kg: 60 } })), '6@60 8@60 10@60 6@60 8@60 10@60 6@62.5');

// Easy run, spec example (week that reaches max shows max; NEXT week resets, no holding)
assert.deepEqual(runSeries({ current: 8, min: 6, max: 12, step: 1 }, 7), [8, 9, 10, 11, 12, 6, 7]);
// Current outside range: W1 uses it as-is, W2 resets to min
assert.deepEqual(runSeries({ current: 11, min: 4, max: 9, step: 1 }, 3), [11, 4, 5]);

// Intervals, spec example
const iv: IntervalConfig = {
  drafts: [{ count: 8, distanceM: 400, restS: 60 }, { count: 5, distanceM: 800, restS: 90 }, { count: 4, distanceM: 1000, restS: 120 }],
  startSpeedKmh: 15, speedStepKmh: 0.5,
};
assert.deepEqual(speedSeries(iv, 5), [15, 15, 15, 15.5, 15.5]);
assert.deepEqual([1, 2, 3, 4, 5].map((w) => draftIndex(w, 3) + 1), [1, 2, 3, 1, 2]);
// Speed edit in W2 propagates, then +Y at the end of the cycle
assert.deepEqual(speedSeries(iv, 5, { 2: 14 }), [15, 14, 14, 14.5, 14.5]);

// Previews (what the "Mark as done" sheet shows)
assert.deepEqual(
  previewRun({ current: 3, min: 2, max: 6, step: 1 }, {}, 4, 4).map((r) => [r.week, r.before, r.after]),
  [[5, '2', '5'], [6, '3', '6'], [7, '4', '2']],
);
assert.equal(previewStrength(squat, {}, 1, { reps: 6, kg: 60 }).every((r) => !r.changed), true);
assert.equal(previewSpeed({ ...iv, startSpeedKmh: 12 }, {}, 5, 12)[0].after, '12');

console.log('progression: all assertions passed');
