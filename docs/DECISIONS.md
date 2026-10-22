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

## UI
- Before/after preview horizon is 3 following weeks (brief: "2-3").
- A draft whose slot has no default weekday is shown as an "unassigned" chip in its week and in the Weeks list.
