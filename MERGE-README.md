# Merged UPSC Odyssey project

This folder combines the original `Upsc-Odyssey-main` source repository with the uploaded generated-content app files.

## Preserved source project
- The original Vite/TypeScript project remains in place (`src/`, `package.json`, tests, docs, CI workflow, etc.).
- The original root `index.html` and `README.md` were preserved; they were not overwritten by the standalone generated-content app.

## Added files
- `generated-content-app.html` — standalone combined UPSC Odyssey + Study Plan app from `upsc-odyssey-plan.zip`.
- `study-plan-only.html` — standalone 180-day study plan.
- `generated-content-odyssey.svg`, `generated-content-manifest.webmanifest`, `generated-content-sw.js` — supporting assets copied from the standalone app bundle.
- `GENERATED-CONTENT-README.md` — instructions from the standalone bundle.

## Important notes
- The standalone app is an additional entry point. The original source app remains the root `index.html`/`src` project.
- The standalone app's service-worker registration references `sw.js`, so test it carefully when hosting alongside the original project. Avoid assuming both apps can share one service worker safely.
- This merge does not configure a live AI provider, and no API key should be placed in browser-side HTML.
