# Behavior spec

Source of truth for behavior. Layout, tokens and copy come from `design/handoff/`. Where this file and the design disagree on behavior, this file wins.

## Principles

- Never store pre-generated weeks. Store plans, slot configurations and user overrides; compute every week on demand.
- Dates are local calendar dates `"YYYY-MM-DD"`. Weeks start on Monday. Week 1 is the week containing the plan start date.
- The progression engine is pure TypeScript (no React, no DB, no clock). Input: plan config + overrides + week index. Output: computed workouts.
- Open-ended plans have no generation limit. A plan with an end date yields no workouts after that date.
- One active plan at a time.

## Final value

Every week is computed from the previous week's **final** value: the user's actual/overridden value if present, otherwise the planned value.

## Progression rules

### Strength (per exercise)

X = reps step, Z = min reps, Y = max reps, N = weight step.

- previous reps >= Y: reps = Z, weight = previous weight + N
- otherwise: reps = min(previous reps + X, Y), weight = previous weight

Week 1 uses the configured current reps and weight. Weights are rounded after addition (62.5 + 2.5 has no float noise).

### Easy run, long run, tempo distance

step X, min Z, max Y.

- previous km >= Y: km = Z
- otherwise: km = min(previous km + X, Y)

The week that reaches max is shown at max; the next week resets to min. There is no holding at max.

- If the initial current value is above max, treat it as already at max: week 1 keeps it, week 2 resets to min.
- If it is below min, just apply the step.
- Config validation warns on min > max, step <= 0, current outside [min, max], but still allows saving. (UI: min > max and step <= 0 are errors that block Next in the wizard; current outside the range only warns. The engine never throws on such configs.)

Tempo: warm-up and cool-down distances are fixed.

### Intervals

D = cycle length in weeks = number of drafts. Each draft has interval count, interval distance (m) and rest (s). Warm-up and cool-down are fixed. Start speed S, speed step Y.

- week w uses draft ((w-1) mod D) + 1
- speed(w) = S + Y * floor((w-1) / D)
- Each draft is a template: count, distance and rest come back unchanged every cycle.
- If the user overrides speed in week k, then for w > k: speed(w) = speedActual(k) + Y * (floor((w-1)/D) - floor((k-1)/D)).
- Overridden count/distance/rest affect only that week.

## Overrides

- An override belongs to one slot and one week: actual values, and/or a moved date, and/or done, and/or deleted.
- Any edited or "marked done" value becomes the baseline for all following weeks.
- Marking done stores a full snapshot of the workout's actual values; edits that are not done store only the fields that differ from the generated value.
- "Reset to generated values" removes the override for that week.
- Moving a workout to another day changes only that week's date.
- Deleting removes only that instance; later weeks keep their values.
- Overrides are folded from the nearest preceding override per slot (per exercise for strength).
- One-off workouts (from "+") never feed progression.

## UI behavior (on top of the design)

- Drafts (not done) look different from done workouts.
- "Mark as done" pre-fills the planned values. If a changed value affects later weeks, show the before/after preview for the next 3 weeks before saving.
- Drag-and-drop in the week view, plus a non-drag "Move to..." action.
- All states from the design: empty, validation errors, warnings, loading, success. Light and dark theme.
- Strength rows are rounded squares, running rows circles, plus a two-letter code; colour is never the only signal.

## Storage and backup

- IndexedDB via Dexie behind a repository interface. No backend, no auth, no network calls.
- JSON export/import with a versioned schema (`schemaVersion`), validated with zod on import. Malformed files are rejected with a clear message; an import never applies partially.
- Backup is prominent in Settings.

## Required examples (exact values)

All of these are unit tests.

| Case | Expected |
|---|---|
| Strength 3 sets, Z6, Y10, X+2, 60 kg, N+2.5 | W1 6@60, W2 8@60, W3 10@60, W4 6@62.5, W5 8@62.5, W6 10@62.5, W7 6@65 |
| Same, user logs W4 as 6@60 | W5 8@60, W6 10@60, W7 6@62.5 |
| Easy run current 8, min 6, max 12, +1 | 8, 9, 10, 11, 12, 6, 7 |
| Step not hitting max (current 8, max 12, +3) | 8, 11, 12, 6, 9, 12, 6 |
| Intervals D=3, S=15, Y=0.5 | W1 D1@15, W2 D2@15, W3 D3@15, W4 D1@15.5, W5 D2@15.5, W7 D1@16 |
| Intervals, Draft 2 = 5 x 400 m, 90 s; user does W2 at 14 km/h with 4 intervals | W3 D3@14, W4 D1@14.5, W5 D2@14.5, and D2 in W5 is again 5 x 400 m, 90 s |
| Open-ended plan | week 200 computes without error |
| Plan with an end date | no workouts after it |
