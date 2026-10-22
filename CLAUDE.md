# Training Planner

Mobile-first web app (later wrapped as Android APK via Capacitor) for planning running and strength training. Single user, offline-first, local data only. Behavior spec: @docs/SPEC.md

## Commands
- `npm run dev` start dev server
- `npm test` run Vitest
- `npm run lint` / `npx tsc --noEmit` lint and typecheck
- `npm run build` production build

## Stack
Vite + React + TypeScript (strict), Dexie (IndexedDB) behind a repository interface, Vitest. No backend, no auth, no network calls. Free/open-source dependencies only. Add a dependency only when it clearly beats ~30 lines of own code.

## Architecture rules
- The progression engine is pure TypeScript: no React, no DB, no Date.now(), no side effects. All business logic lives there or in other pure modules.
- Never store pre-generated weeks. Store configs + user overrides; compute weeks on demand.
- Dates are "YYYY-MM-DD" strings (local calendar dates), weeks start Monday. No timestamps for plan dates.
- UI components do not contain business logic. Data access only through repository interfaces.
- Feature-based folders (src/features/<name>), shared code in src/shared. No circular imports.

## Code quality (senior level)
- TypeScript strict. No `any`, no non-null `!` without a comment explaining why, no `@ts-ignore`.
- Model states with discriminated unions; validate external data (imported JSON, DB reads) at the boundary with a schema (e.g. zod) instead of trusting types.
- Small, single-purpose functions and components; descriptive names; no dead code, no commented-out code, no TODOs left behind.
- No premature abstraction: duplicate twice, abstract on the third occurrence.
- Handle errors explicitly; user-facing errors are clear and actionable. No swallowed exceptions.
- Accessibility: labeled inputs, keyboard and focus handling in sheets/dialogs, touch targets >= 44px, sufficient contrast in both themes.
- Mobile-first, standard web APIs only (no hover-only interactions, respect safe-area insets).

## Testing
- Every progression rule has unit tests with exact expected values (see docs/SPEC.md). Never change a rule without updating its tests in the same commit.
- Test behavior, not implementation. UI tests only for critical flows (create plan, mark as done with propagation, export/import).

## Git
- Conventional Commits (feat:, fix:, refactor:, test:, docs:, chore:). One logical change per commit.
- Commit after each milestone, only when `npm test`, `tsc --noEmit`, and lint pass.
- Never force-push, never rewrite pushed history, never commit secrets or .env files.

## Working style
- Do not ask clarifying questions mid-task. Choose the simplest reasonable option and record it in docs/DECISIONS.md.
- Out of scope for v1: budgeting, races, gear, gym memberships, accounts, integrations. Do not build them.
- Keep this file short. Detailed rules go in docs/.