# Live repository vs. updated package

Comparison date: 2026-10-21
Repository inspected: `akashbsp1997/Upsc-Odyssey`, default branch `main`

## Live repository findings

The live repository was accessible through the GitHub connector. These files were fetched from `main`:

- `package.json`
- `src/ui/App.tsx`
- `src/game/campaignBuilder.ts`
- `src/ui/styles.css`
- `src/content/day-01.json`

The live branch did **not** contain `src/content/campaigns/day-002.json` or `docs/180-day-campaign-index.csv` when checked. The live `App.tsx` also lacked the bundled-campaign glob used by this package to load the campaign library on startup.

## Comparison of key files

| File | Result |
|---|---|
| `package.json` | Same content as live `main` at comparison time |
| `src/game/campaignBuilder.ts` | Same content as live `main` at comparison time |
| `src/ui/App.tsx` | Updated package adds bundled 180-day campaign loading, campaign source/PYQ display, and the expedition route map |
| `src/ui/styles.css` | Updated package includes the route-map styles and mobile layout |
| `src/content/day-01.json` | Updated package includes campaign metadata for the 180-day plan |
| `src/content/campaigns/day-002.json` through `day-180.json` | Present in updated package; absent from the live branch paths checked |
| `docs/180-day-campaign-index.csv` | Present in updated package; absent from live branch when checked |
| `src/content/campaignLibrary.test.ts` | Added campaign-library checks, including weekly boss-day content checks |

## Improvements in this package

- Adds a scrollable six-region, 180-day expedition route to the World screen.
- Makes each day a clickable route node, respecting the existing day-unlock rule.
- Visually distinguishes cleared, available, locked, and weekly boss-trial nodes.
- Keeps the subject mastery cards and campaign ledger as complementary views.
- Retains offline IndexedDB storage and source/PYQ reference metadata.

## Validation status

- Campaign JSON parsed and checked: 180 unique consecutive days, dates 2026-10-19 through 2027-04-16.
- Every campaign has source and PYQ reference metadata; PYQ records explicitly remain topic-level leads unless exact official question details are verified.
- All 25 days divisible by seven contain a Mains-type activity with at least 25 points.
- TypeScript transpile syntax check of `src/ui/App.tsx`: passed with zero syntax diagnostics.
- Full `npm test` and `npm run build`: not run because project dependencies are not installed and package registry access was unavailable in the earlier setup attempt. A successful production build is therefore not claimed.
- No remote GitHub files were changed by preparing this package.
