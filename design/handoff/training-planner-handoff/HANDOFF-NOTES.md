# Training Planner — instructions for Claude Code

Build the v1 app described in `README.md`, using `design/` as the visual source of truth and `reference/progression.ts` as the domain engine.

## Stack and constraints

- Vite + React + TypeScript (strict), plain CSS with the tokens from `design/tp.css` (CSS variables, `data-theme="dark"`). No UI kit, no backend, no auth.
- Mobile-first at 360–430 px, desktop is a secondary responsive layout (centre the phone layout, widen lists).
- Offline-first: all data local. Wrap storage in a repository interface; implement it with IndexedDB or localStorage.
- Touch-first: targets ≥ 44 px, bottom sheets, safe-area insets, no hover-only behaviour. Real `<button>`/`<a>`/`<input>` + `<label>`; `aria-label` on icon-only buttons.
- Lists (calendar, weeks) must be unbounded: derive weeks on demand, never cap at "N weeks ahead".

## Order of work

1. Move `reference/progression.ts` and its test into `src/domain/`; get the tests green in vitest. Do not change the rules.
2. Domain layer: types from README, `deriveWeek(plan, week, overrides)` built on the engine, JSON export/import with `schema` + `version`.
3. Design tokens + shared components (`TypeBadge`, `WorkoutRow` with draft/done/edited states, `Stepper`, `Sheet`, `Banner`, `Toast`, `TabBar`, `Sparkline`).
4. Screens in this order: Settings (export/import), Plan wizard, Calendar (month, week + drag), Weeks, Workout sheets (view, mark done with preview), Plans.
5. Dark theme pass, states from `design/States.dc.html`, then an accessibility pass.

## Rules

- Match the copy and states in `design/*.dc.html`; read an artboard's markup before building its screen.
- Keep colour meaning exclusive to workout types (see README).
- Do not persist generated drafts; persist config and overrides only.
- Ask before adding scope: budgeting, races, gear, gym memberships, integrations, accounts and social features are out of scope for v1.
