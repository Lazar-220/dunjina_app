# Training Planner

Mobile-first web app for planning running and strength training. Single user, offline-first, all data stays on the device (IndexedDB). No backend, no accounts, no network calls.

## Run

```
npm install
npm run dev        # dev server
npm test           # Vitest (runs with TZ=Europe/Belgrade)
npm run lint
npx tsc --noEmit   # typecheck
npm run build      # production build into dist/
```

Behavior rules live in [docs/SPEC.md](docs/SPEC.md); every assumption is listed in [docs/DECISIONS.md](docs/DECISIONS.md).
