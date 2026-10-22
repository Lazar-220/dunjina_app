# Training Planner v1 — design handoff

Mobile-first web app (later wrapped as an Android app) for a recreational half-marathon runner who also lifts. Single user, no login, no server, all data local, export/import as JSON.

## Bundle contents

| Path | What it is |
|---|---|
| `CLAUDE.md` | Working instructions for Claude Code. Copy to the repo root. |
| `README.md` | This file: screens, data model, rules, decisions. |
| `reference/progression.ts` | Tested, pure progression engine. Port as-is into `src/domain/`. |
| `reference/progression.test.ts` | Spec examples as assertions (`npx tsx reference/progression.test.ts`). |
| `design/*.dc.html` | The prototype, one file per screen (390×844). Source of truth for layout, copy and states. |
| `design/tp.css` | Design tokens (CSS variables, light + dark) and component classes. Lift tokens into your CSS. |
| `design/canvas.json` | Canvas index: artboard names and positions. Not needed at runtime. |

The `.dc.html` files use a prototype runtime (`<x-dc>`, `{{holes}}`, `<sc-for>`). Read them for markup, copy and class names; do not try to run them standalone. Each `<script type="text/x-dc">` block holds the logic used for that screen's mock data (several contain the same progression code as `reference/progression.ts`).

## Screen map

| Artboard file | Screen | Suggested route / component |
|---|---|---|
| `Main.dc.html` | Calendar, month grid + agenda (day selection works) | `/` `CalendarMonth` |
| `Cal-Week.dc.html` | Calendar, week list with drag state (`mode="drag"`) and rest state | `/week` `CalendarWeek` |
| `Cal-Move.dc.html` | "Move to…" sheet (non-drag alternative) | `MoveSheet` |
| `Cal-Add.dc.html` | "+" sheet: one-off workout by type | `AddWorkoutSheet` |
| `Cal-Empty.dc.html` | No active plan: Create plan / Import | `CalendarEmpty` |
| `W1-Basics` … `W7-Review` | Plan wizard: basics, structure, 4 slot-config variants, review | `/plans/new/:step` |
| `Weeks.dc.html` | Weeks list (expand/collapse, inline edit of W6 long run is live) | `/weeks` |
| `Weeks-Edit.dc.html` | Same component, `mode="edit"`: inline edit open + loading skeleton | — |
| `Sheet-View.dc.html` | Workout sheet (strength) | `WorkoutSheet` |
| `Sheet-Done.dc.html` | Mark as done, live before/after preview (steppers work) | `MarkDoneSheet` |
| `Sheet-Intervals.dc.html` | Mark as done for intervals (speed propagates vs session-only fields) | `MarkDoneSheet` (intervals variant) |
| `Plans.dc.html`, `Plan-End.dc.html` | Plans list, end-plan confirmation | `/plans` |
| `Settings.dc.html` | Backup/restore first, theme | `/settings` |
| `States.dc.html` | Validation, warnings, loading, toasts, import dialogs, workout states, tags, colour key | shared components |
| `*-Dark.dc.html` | Dark theme (same components, `theme="dark"`) | `data-theme="dark"` on root |

Prototype navigation: tab bar, FAB and workout rows are real links, so the flow can be clicked through in Play mode.

## Design system essentials

- **Colour means workout type only.** Buttons, tab bar and FAB are neutral (ink). Types: lower `--t-lo`, upper `--t-up`, easy `--t-ez`, long `--t-lr`, tempo `--t-tp`, intervals `--t-iv` (separate values for light and dark in `tp.css`).
- **Colour is never the only signal:** strength = rounded square, running = circle, plus two-letter code `LO UP EZ LR TP IV`.
- **Workout states:** draft = dashed outline, no fill; confirmed = solid outline; done = tinted fill + check; edited = black `edited` pill with the generated value struck through; dragging = lifted with shadow.
- **Type:** Figtree (UI), DM Mono (numbers in tables). Tabular numerals everywhere.
- **Touch targets ≥ 44 px**, bottom sheets instead of drawers, safe-area insets via `env(safe-area-inset-*)`, no hover-only interactions, no fake status bar or keyboard.
- Weeks start on Monday. Units: km, kg, km/h, seconds; interval rep distance is in metres (deliberate exception, e.g. 5 × 800 m).

## Domain model (store config + overrides, derive everything else)

```ts
type SlotType = 'lower' | 'upper' | 'easy' | 'long' | 'tempo' | 'intervals';

interface Plan {
  id: string; name: string;
  startDate: string;            // ISO date, must be a Monday (snap on input)
  endDate: string | null;       // null = open-ended
  endedAt?: string;             // set by "End plan"
  slots: Slot[];
}
interface Slot {
  id: string; type: SlotType; label?: string;   // "Easy run A"
  defaultWeekday?: 0|1|2|3|4|5|6;               // 0 = Monday
  config: ExerciseConfig[] | RunConfig | TempoConfig | IntervalConfig; // see reference/progression.ts
}
// User state, keyed by slotId + week number (1-based):
interface Override { slotId: string; week: number; values: unknown; weekday?: number; done?: boolean; note?: string; deleted?: boolean }
interface OneOffWorkout { id: string; date: string; type: SlotType; values: unknown; done?: boolean }
```

- **Never persist generated drafts.** Compute week N by folding from week 1 with the overrides (`reference/progression.ts`). Open-ended plans and "scroll forever" fall out for free; "Reset to generated" = delete the override.
- A weekday on an override moves that one instance. A draft without an override uses the slot's `defaultWeekday` (if none, it appears in the week with no day assigned: show it in the Weeks list and as an unassigned chip in the week view).
- One-off workouts (from "+") never feed progression.
- Tempo = `RunConfig` for the tempo km plus fixed `warmupKm` / `cooldownKm`. Intervals have `warmupKm` / `cooldownKm` too.

## Progression rules (the engine implements exactly this)

Each week is computed from the previous week's **final** value (actual if logged or edited, otherwise planned).

- **Strength, per exercise:** previous reps ≥ max → reps = min, weight = previous + weight step; else reps = min(previous + reps step, max), weight unchanged. Week 1 = the configured current values.
- **Easy / long / tempo distance:** previous ≥ max → min; else min(previous + step, max). The week that reaches max is shown at max, the next resets. No holding at max. If *current* is above max, week 1 keeps it and week 2 resets (UI shows a non-blocking warning).
- **Intervals:** drafts 1..D rotate by week. Speed is the only progressing value: after every full cycle of D weeks, speed += Y. An edited speed propagates to all later weeks. An edited count, distance or rest affects only that week; the draft comes back unchanged next cycle.
- Floats: round after additions (62.5 + 2.5) to avoid noise.

## Interaction decisions to preserve

1. **Mark as done** opens pre-filled with the planned values; only differences count as edits. A change that alters later weeks shows a before/after preview for the next 3 weeks before saving (`previewRun`, `previewStrength`, `previewSpeed`). Unchanged → green "Matches the plan" note.
2. **Intervals split their form by scope:** "All later weeks" (speed) vs "This session only" (count, distance, rest), with the sentence about when the draft returns.
3. **Drag and drop is only in the week view,** long-press to lift. Every workout row has a `⋯` button with "Move to…" as the accessible alternative. Past days are allowed but visually muted.
4. **Weeks list is infinite:** week cards load more on demand (skeleton while generating). Collapsed week header shows ≈ running km and a status line (`3 of 7 done`, `1 edited`).
5. **Reset exists at two levels:** per workout (inline editor) and per week ("Reset week to generated values").
6. **"+" adds a one-off workout** and says so; plan slots are edited via their draft or via Edit plan.
7. **Delete removes only that instance;** later weeks keep their values.
8. **End plan** keeps everything done and edited, removes drafts after the end date, and cannot be restarted (duplicate instead).
9. **Backup is first-class:** the Settings "Your data" card is the first thing on the screen, shows the age of the last backup (warning after 7 days) and the file name. Import always shows a summary and a confirmation, and a bad file changes nothing. Format: `{ "schema": "training-planner", "version": 1, ... }`; refuse newer versions with a clear message.
10. **Validation:** min > max blocks Next (error); current outside min–max only warns. End date ≤ start date blocks Next.

## Open points (decide with the product owner)

- Android packaging is undecided (the author wants to avoid installing Android Studio). Keep the web build a plain static PWA first; Capacitor or a TWA can be evaluated later.
- Persistence: start with IndexedDB (or localStorage for v1 size) behind a small repository interface so the backend can be swapped; export/import must read and write the same shape.
- Behaviour of the weekday of a draft when its default weekday is unset is described above but not drawn in detail.
- The prototype contains no animations beyond the skeleton shimmer; sheet transitions and drag animation are up to the implementation.
