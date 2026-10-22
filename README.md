# UPSC Odyssey

UPSC Odyssey is an offline-first, mobile-friendly preparation RPG for the Civil Services Examination. It turns locally imported daily JSON packages into lessons, recall prompts, MCQs, statement questions, assertion-reason questions, comparisons, case studies, Mains writing, revisions, timed tests, and boss encounters. Gameplay makes no AI/API requests and needs no account, subscription, key, or backend.

Campaigns and learner progress are stored in IndexedDB on the current browser/device. The included Day 1 Polity campaign is seeded on first launch when the local campaign library is empty.

## Requirements

- Node.js 20 or newer
- npm
- A modern browser; Chrome/Edge, Firefox, and Safari are supported for normal web use

## Run locally

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Run checks and create a production bundle with:

```sh
npm test
npm run build
npm run preview
```

The production output is `dist/`. The build runs strict TypeScript checking before Vite bundling. Vitest exercises campaign validation, scoring, XP, duplicate handling, persistence, revision scheduling, completion, and backup restore.

## Use the app

1. Open Campaigns to see imported daily packages. The Day 1 example is available on a fresh installation.
2. Open Arena to choose a session target from 15 minutes to 8 hours. Only unique unfinished content and due revisions are scheduled. The app reports the available duration rather than repeating content to fill a target.
3. Read lessons and complete their learning objectives. Answer challenges, reveal optional hints, record confidence, and use rubrics/model answers to self-assess written work.
4. Incorrect attempts are recorded and scheduled for revision; they do not permanently block the campaign.
5. Open the Importer to select one or more `.json` packages. The app validates all files and presents a preview before saving. Duplicate IDs are reported and existing campaigns are preserved.

## Daily content with ChatGPT

Generate the educational material separately from gameplay. Ask ChatGPT for **one JSON object only**, without Markdown fences, matching the contract documented in [docs/content-schema.md](docs/content-schema.md). A ready-to-import sample is [src/content/day-01.json](src/content/day-01.json).

Suggested prompt:

> Create one UPSC CSE learning campaign as a single JSON object conforming exactly to the version 1 schema in docs/content-schema.md. Use a unique campaign ID and unique lesson/activity IDs. Keep factual claims precise and appropriately qualified. Include a balanced set of lessons and varied activities from the supported types. Every activity must contain its answer, concise explanation, and useful hint; choices must have stable option IDs and the answer must equal a choice ID. Written tasks need a realistic scoring rubric and model answer. Estimate honest reading/solving durations; do not add filler to reach a target. Return valid JSON only.

Save the response as a `.json` file, inspect it, then import it in the app. The importer reports JSON syntax and schema errors with field paths. Importing stores the parsed package locally; no content-generation service is called during play.

## Content contract

The canonical Zod contract is implemented in [src/content/schema.ts](src/content/schema.ts), and the field guide is [docs/content-schema.md](docs/content-schema.md). The versioned Day 1 sample is complete and kept in source control. Durations are per lesson/activity; `estimatedDurationMinutes` is the author’s overall campaign estimate and must be no more than 480 minutes.

## Progress backups

Open Player Profile and choose **Export backup** to download a JSON file containing campaigns, progress, attempts, and review schedule. To restore on another browser/device, open the app there and choose **Restore backup**. Restore validates the complete file, merges campaigns by ID, and replaces the current progress, attempts, and review history. Keep the backup somewhere you control; browser storage is not a substitute for a backup.

## Install as a PWA

Deploy over HTTPS first, then visit the site in Safari on iPhone. Tap **Share**, choose **Add to Home Screen**, confirm the name, and tap **Add**. Launch Odyssey from the Home Screen for its standalone app window. On desktop Chromium browsers, use the install icon in the address bar or the browser menu's install option.

The service worker precaches the application shell and static build assets. Imported campaign content and progress are available offline from IndexedDB after import. Offline installation/service workers require a secure context (HTTPS; localhost is allowed for development). Safari/iOS behavior and available storage vary by OS version and device policy. Private browsing, clearing site data, low storage, or browser eviction can remove local data. Export backups regularly. Storage is per browser and does not synchronize between devices.

## Deploy to Cloudflare Pages

This repository is configured for a static Cloudflare Pages deployment:

- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/`
- Node.js: 20 or newer
- Build environment variables/secrets: none required

To connect GitHub to Cloudflare:

1. Sign in to Cloudflare and open **Workers & Pages**.
2. Choose **Create application** → **Pages** → **Connect to Git**.
3. Authorize GitHub access to the `upsc-odyssey` repository and select the repository/production branch (`main`).
4. Select **Vite** if offered, then set the build command and output directory above. Leave the root directory at `/` and add no API keys.
5. Save and deploy. Cloudflare builds subsequent pushes to the configured branch and creates preview deployments for other branches/PRs according to project settings.
6. Wait for a successful deployment, open its URL, and verify the app loads. Check that the manifest/service worker are available in browser developer tools before relying on offline mode.

The checked-in `public/_redirects` provides the SPA fallback. GitHub Actions in `.github/workflows/ci.yml` runs `npm ci`, tests, and the production build on pushes to `main` and pull requests. It does not deploy; Cloudflare Git integration is the deployment path. Do not add provider tokens to source control.

## Repository workflow

The project is intended to live in the GitHub repository `upsc-odyssey`. Connect/authorize that repository in VS Code or clone it, then use the checked-in GitHub Actions workflow for CI. Deployment is only considered live after Cloudflare reports a successful publish and its URL has been checked.

## Known limitations

- No server-side sync, shared accounts, or cross-device progress synchronization is included.
- Browser storage quotas and eviction policies vary; export backups for important progress.
- Service-worker installation and offline behavior require HTTPS in deployed environments and may differ across browsers, especially iOS Safari.
- Mains and other rubric-based written answers are self-assessed; the app does not use AI or claim automated essay grading.
- Session estimates use authored activity durations. Idle time is not added while the browser tab is hidden, and pausing suspends the session timer.
- Educational packages are user-provided.# UPSC Odyssey Current Affairs module

This starter module adds a NewsAPI.org ingestion pipeline, explainable UPSC classification, an archive UI panel, date filters, and scheduled/on-demand GitHub Actions ingestion.

## Provider limits
Your NewsAPI plan determines which dates, volume and use cases are permitted. The pipeline can only fetch what the API returns. Use smaller monthly windows for backfill; a single year may exceed provider result caps. Check current provider terms before publishing/redistributing data. The module stores metadata, links and short descriptions, not full articles.

## Install
Copy the files in this module into the same paths at the root of `akashbsp1997/Upsc-Odyssey`. If any path already exists, compare before overwriting.

## Add the secret
Go to `https://github.com/akashbsp1997/Upsc-Odyssey/settings/secrets/actions`, create repository secret `NEWS_API_KEY`, and paste your NewsAPI key. Never put the key in frontend code or commit it.

## Integrate into `src/ui/App.tsx`
1. Add import: `import CurrentAffairsPanel from '../current-affairs/CurrentAffairsPanel';`
2. Add `Newspaper` to the existing `lucide-react` import.
3. Extend the `Page` type to include `'current-affairs'`.
4. Add `{ id: 'current-affairs', label: 'Current Affairs', icon: Newspaper }` to the existing `navigation` array. This array already drives both the desktop rail and mobile navigation, so do not add duplicate buttons.
5. Add `'current-affairs': 'Current affairs'` to the `title` record.
6. Inside the main `.page-content` JSX, add the render branch alongside the other page branches: `{page === 'current-affairs' && <CurrentAffairsPanel />}`.
7. In `src/ui/styles.css`, change `.mobile-nav` from `grid-template-columns: repeat(4,1fr)` to `repeat(5,1fr)` so the added navigation item fits.
8. The panel imports its own CSS; no extra stylesheet import is needed.

## Test
```bash
node --test scripts/current-affairs/classify.test.mjs
npm test
npm run build
git diff --check
```

## Configure and run
After adding files and pushing them:
- Open GitHub Actions → **UPSC Odyssey Current Affairs** → **Run workflow**.
- Enter optional `from` and `to` dates in `YYYY-MM-DD` format. Leave blank for the recent window.
- The daily scheduled job runs at 01:30 UTC (07:00 IST), though GitHub may delay scheduled jobs.
- Workflow updates `public/data/current-affairs.json` and commits it to `main` when changed.

For a historical backfill, run smaller windows (for example, month by month) and watch API quota. The first classification is deterministic and approximate; articles marked `needs-review` can be shown using the panel's checkbox. Static topics are a starter index, not a fully researched static-affairs corpus. Review factual accuracy and exam relevance before importing.
