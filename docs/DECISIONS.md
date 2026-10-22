# Decisions

Every assumption made while building v1. Format: **decision** — why. Items marked *(review)* deserve a second look.

## Precedence and scope
- Root `CLAUDE.md` wins over `design/handoff/.../HANDOFF-NOTES.md`; the build brief wins over the design where behavior conflicts. Concretely: no questions mid-task (handoff said "ask before adding scope"), own engine and tests instead of porting `reference/progression.ts`, no UI kit.
- No PWA manifest or service worker: Android wrapping (Capacitor) comes later; v1 is a plain static web build.
- No Capacitor, router, drag-and-drop or virtualization libraries: a small hash router, pointer-event drag and an IntersectionObserver "load more" are less code than the dependencies.

## Dates and weeks
- Week 1 is the week containing the plan start date; the start date can be any weekday (the handoff README required a Monday). *(review)*
- Date arithmetic uses UTC day numbers, never local `Date` math, so DST changes (e.g. Europe/Belgrade 2026-03-29 and 2026-10-25) cannot shift a day. Tests run with `TZ=Europe/Belgrade`.
- A slot whose default weekday falls before the start date in week 1 is clamped to the start date instead of being dropped, so the configured week-1 value is never lost.

## Data and backup
- Fonts are bundled with `@fontsource` packages, not loaded from Google Fonts, because the app makes no network calls.
- Backup file: `{ "schema": "training-planner", "schemaVersion": 1, ... }`. The handoff used `version`; the brief used `schemaVersion`; both the marker and `schemaVersion` are written.
- One active plan at a time. Creating a new plan while one is active asks the user to end the current one first. *(review)*
- Marking a workout done stores a full snapshot of all its actual values in the override, so later edits to earlier weeks or to the plan config never change logged history. Edits that are not done stay sparse (only fields that differ from the generated value). A done override is a baseline for later weeks like any other.

- Device preferences (theme, date of the last backup) are stored in IndexedDB but are **not part of the backup file**: they describe this device, and importing must not change them. The backup holds plans, overrides and one-off workouts.
- The last backup is stored as a local calendar date (`YYYY-MM-DD`), not a timestamp; its age is counted in whole days.
- Import validates more than the shape: duplicate plan/slot/one-off ids, changes that point at a missing slot, duplicate changes for one week, and values of the wrong kind are all rejected. Import runs in one Dexie transaction, so a failure leaves the old data untouched.
- No in-memory repository: tests use the real Dexie implementation on fake-indexeddb, so there is only one implementation to keep correct.
- Reads from IndexedDB are validated with zod; unreadable rows raise `StoredDataError` ("Import a backup to restore your data") instead of crashing later.
- Backup download uses the standard Blob + `<a download>` mechanism. If Android's WebView later does not honour it, only `shared/download.ts` needs a Capacitor-specific path.
- "Load demo plan" refuses to run while a plan is active (one active plan at a time) and says so; it is available until ending a plan exists (M6).
- Theme `system` follows `prefers-color-scheme` live; the choice is applied as `data-theme` on `<html>`, so tokens work for dialogs and the page background alike.

## UI
- Before/after preview horizon is 3 following weeks (brief: "2-3").
- A draft whose slot has no default weekday is shown as an "unassigned" chip in its week and in the Weeks list.

## Validation
- Min above max, step <= 0 and current outside [min, max] are **warnings that never block saving**, as the brief says. The handoff design drew min > max as a red error that blocks Next; I follow the brief and show it as a warning banner. Only an end date on or before the start date, an empty name/exercise name, and an intervals slot with no drafts block Next. *(review)*
- Weight step 0 is allowed (a lifter may hold the weight); only a negative weight step warns.
- With min > max the engine does not throw: after the first week every value settles on min.

## Engine
- Overrides are keyed by slot and week. A not-done edit stores only the changed fields (reps and weight of an exercise are folded independently); a done override stores every field of the workout. Interval warm-up/cool-down and tempo warm-up/cool-down are part of the snapshot, so editing the plan later cannot rewrite history.
- A deleted workout keeps its override: if it carried values, those values still feed later weeks ("later weeks keep their values").
- Overrides whose `kind` does not match the slot type are ignored by the engine instead of throwing.
- `planned` is the value generated from the previous week's final value, ignoring that week's own override; `actual` applies the override. A workout is `edited` when they differ, so marking done with unchanged values is not an edit.
- Workout status: `draft` (no override), `confirmed` (values edited or date moved, not done), `done`.
- Plan end: `endDate` and `endedOn` (set by "End plan") both cut the plan; the earlier one wins. Drafts and edited-but-not-done workouts after it do not exist.
- **A plan's end never hides a done workout.** Two layers: (1) *block* — `validatePlanEnd` rejects an end date (typed in the plan editor, or today for "End plan") earlier than the latest done workout, with the message "The plan can't end before your last done workout on Thu 22 Oct 2026. Pick that date or later." The end date stays unchanged until the user picks a valid one; I chose blocking over silent clamping so the user stays in control of the date. (2) *safety net* — the engine itself never cuts a done workout, so backups imported from elsewhere or a done workout moved past the end still show. An unassigned done workout counts as the Monday of its week for this rule. Deleting a done workout still removes it.
- Floats are rounded to 3 decimals after every addition.

## Cross-check against `design/handoff/.../reference/progression.ts`
My engine and tests were written from the brief; afterwards I ran 1,200 randomized configurations (run, strength, interval speed; 30 weeks each; random overrides; including current above max, current below min, min above max) through both implementations. **No numeric disagreement.** Differences that are not numeric, and which side I followed:
- The reference assumes the plan starts on a Monday; mine accepts any start date (brief).
- The reference rounds to 2 decimals, mine to 3 (identical on the tested step sizes).
- The reference takes whole-series override maps per config and folds from week 1 each time; mine takes per-slot overrides (sparse or snapshot), folds from the nearest override, and also handles dates, deletes and plan end.
- The reference validates nothing; mine returns warnings/errors (see Validation).
- The reference's `previewX` helpers are three near-identical functions; mine is one `previewImpact` built on the same code path that renders the weeks, so the preview cannot disagree with the calendar.

## Calendar and workout sheets (M4)
- The calendar shows workouts of **all** plans plus one-offs, so history of an ended plan stays visible; the Weeks tab works on the active plan only.
- The "⋯" button on a week row opens the Move sheet directly ("Move to…" is the only non-drag action the brief asks for); tapping the row opens the full workout sheet, which also has Move to….
- Free-form "workout notes" from the sheet design are not built (not in the brief, no place in the data model). Per-exercise notes entered in the plan wizard are shown in the workout sheet.
- A new one-off starts with sensible defaults (easy run 5 km, long run 10 km, tempo 3 km, intervals 5 × 400 m @ 12 km/h, one strength exercise 3 × 8 @ 20 kg). One-off strength workouts are free-form: exercise names, sets, reps and weight can be edited and exercises added or removed. One-offs never feed progression and show no before/after preview.
- Steppers are also text inputs (decimal keyboard), so any value can be typed. Step sizes when logging: reps 1, weight 2.5 kg, run distance 0.5 km, speed 0.5 km/h, interval distance 50 m, rest 5 s.
- The date fields of the Add and Move sheets use the browser's native date input (standard web API, accessible, no custom picker to maintain).
- Every change shows a toast with Undo; Undo restores the exact previous override (or removes the one just created).
- "Reset to generated values" on a workout deletes its whole override, including a done flag and a moved date.
- Plan data is held in memory and reloaded from IndexedDB after every write (volumes are small); screens never read the database directly.
- Month grid shows 5 or 6 rows as the month needs; each day shows at most 4 dots.
