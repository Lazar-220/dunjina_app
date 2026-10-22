# Training Planner

Mobile-first web app for planning running and strength training. Single user, offline-first, all data stays on the device (IndexedDB). No backend, no accounts, no network calls (fonts are bundled). Built to be wrapped as an Android app with Capacitor later; that wrapper is not part of this version.

## Run

Requires Node 20 or newer.

```
npm install
npm run dev        # dev server (http://localhost:5173)
npm run build      # type-check, then production build into dist/
npm run preview    # serve the production build
npm test           # Vitest (runs with TZ=Europe/Belgrade, see below)
npm run lint
npx tsc --noEmit   # typecheck only
```

Open the app, go to **Settings** and press **Load demo plan** to see everything with data (1 lower, 1 upper, 2 easy runs, 1 tempo, 1 long run, 1 intervals).

## What it does

- **Calendar**: month grid with an agenda for the selected day, and a week list where workouts can be moved by long-press drag or by the "⋯" button. "+" adds a one-off workout.
- **Workout sheet**: view, mark as done, edit, move, delete, reset. "Mark as done" starts from the planned values; if your numbers change later weeks, a before/after preview of the next 3 weeks is shown before saving.
- **Weeks**: an endless list of weeks computed on demand, with inline run editing, per-week reset and progression tags.
- **Plans**: one active plan at a time; end it, edit it, or duplicate an ended one. The plan wizard (basics, weekly structure, slot configuration, review) projects the first 8 weeks of every slot before you save.
- **Settings**: export and import a JSON backup (first thing on the screen), theme (light, dark, system), demo plan.

Progression rules, overrides and data formats are specified in [docs/SPEC.md](docs/SPEC.md). Every assumption made while building is listed in [docs/DECISIONS.md](docs/DECISIONS.md).

## How it is built

- Vite, React, TypeScript (strict), Dexie (IndexedDB), zod, Vitest. No UI kit, no router, no drag-and-drop library.
- `src/domain/`: the progression engine and everything pure (dates, schemas, validation, schedule, before/after impact). No React, no database, no clock.
- `src/data/`: the repository interface, its Dexie implementation, and the versioned backup format (validated with zod on import; an import is all-or-nothing).
- `src/features/<name>/`: calendar, workout, weeks, plans, wizard, settings, plan-data.
- `src/shared/`: design tokens and components, hash router, small helpers.
- Nothing generated is stored: only plans, slot configurations and your overrides. Weeks are computed on demand, so an open-ended plan has no limit.
- Dates are plain local `YYYY-MM-DD` strings and weeks start on Monday. Tests run with `TZ=Europe/Belgrade` (set in `vite.config.ts`) to prove date logic is unaffected by daylight-saving changes.

## Backup

Settings → **Export backup** downloads `training-planner-YYYY-MM-DD.json`. **Import backup** validates the file, shows a summary and asks for confirmation before replacing what is on the device. A malformed file, a file from a newer app version, or a damaged file changes nothing.
