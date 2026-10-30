# Reconciling production with main

Branch: `claude/eu-hub-prod-main-reconcile-266qgx`, started from `live-snapshot-2026-10-30` (`5c32dd4`, the deployed source).
Compared against: `origin/main` at `6139f7e` (the hardening pass described in `HARDENING-REPORT.md` on main, base `faab401`).

Result: production behaviour plus the quality-pass fixes that apply to the live code. Nothing from main that is not live was added.

## How production relates to main

Production is not an older or newer commit of main. It is a separate line of the code: `src.bak-2026-09-09/` (a backup the server holds of its September state) differs from every commit on main in 48 files. Main's first commit ("production-ready demo release") added a demo/snapshot mode, a request guard, personalization and a source health panel that production never had. Production instead grew its own hardening (`src/lib/model-guard.ts`, `model-schema.ts`, `rss-loader.ts`) and already runs Next 16.4.3.

The git history cannot show which side is newer for small UI differences (theme default, tab colours, manifest icons). Where a file differs and the difference is not a quality-pass fix, production's version is kept. That is what "behaviour equals production" requires either way.

## Classification

Classes: **a** live-only change (kept), **b** main-only feature not live, **c** main's quality-pass fix. A path can carry more than one class.

78 paths differ between main and the snapshot, plus 54 files under `src.bak-2026-09-09/`.

### Repository and tooling

| Path | Class | Decision |
| --- | --- | --- |
| `package.json` | a, b, c | Kept production's (`next build --webpack`, `eslint-config-next` 16.4.3, `test:security`). `next` 16.4.3 (A1) is already live. Added main's `test` script and `tsx` devDependency to run the ported tests. Left out main's `check`, `demo:*` and `preflight` scripts. |
| `package-lock.json` | a, c | Kept production's versions. Bumped only the packages main's quality pass moved for advisories where production was still below (see Dependencies). |
| `next.config.ts` | a, b | Kept production's `outputFileTracingRoot`. Left out main's CSP header (b): untested against the live pages, which fetch Eurostat and flagcdn from the browser. |
| `eslint.config.mjs` | new | Not different between main and live. Changed here so lint passes, see Lint. |
| `middleware.ts` | b | Left out. Request-id echo; the hardening report notes it echoes an unvalidated client header. |
| `.env.example`, `.gitignore` | b | Left out. Documents demo mode and `TRUSTED_CLIENT_IP_HEADER`, neither of which exists in live code. |
| `README.md`, `CONTRIBUTING.md`, `LICENSE`, `docs/*` (3), `.github/ISSUE_TEMPLATE/*` (2) | b | Left out. Repository documentation, no runtime effect. They stay on main. |
| `HARDENING-REPORT.md` | c | Left out. The report itself; its applicable content is summarised below. |
| `scripts/refresh-demo-snapshots.ts`, `scripts/release-preflight.sh` | b | Left out. Belong to demo mode. |
| `test-implementation.js` | a | Kept, untouched. Stray script on the server; it `require`s TypeScript files and does not run. Excluded from lint. |
| `src.bak-2026-09-09/**` (54 files) | a | Kept, untouched. Server-side backup, not imported by the app. Excluded from lint. Safe to delete later. |

### API routes

| Path | Class | Decision |
| --- | --- | --- |
| `src/app/api/chat/route.ts` | a, b, c | Kept production's. A3 (415 on non-JSON) and A8 (no error body logging, 502) are already solved by `readJSON` and `modelFetch` (which throws a 502 `GuardError` before the route sees a non-ok response). Main's version is built on `api-guard`, `request-id` and `source-registry` (b). |
| `src/app/api/chat/stream/route.ts` | a, b, c | Same as chat. Production also cancels the upstream stream on client disconnect, which main lists as an open hardening idea. |
| `src/app/api/dashboard-welcome/route.ts` | a, b, c | Same as chat. |
| `src/app/api/eu-comparison-insight/route.ts` | a, b, c | Same as chat. |
| `src/app/api/translate-indicators/route.ts` | a, b, c | Kept production's. A5 (unbounded key map) is solved by `model-schema.translation()`: at most 40 keys, key pattern, 300 chars per value, request rejected otherwise, plus the 20 kB prompt cap in `modelFetch`. |
| `src/app/api/eu-feed/route.ts` | a, b, c | Kept production's route (inline RSS parser, shared `rss-loader`, cache keyed on the hashed client IP). **Ported B1** (score regex) and **B2** (malformed `pubDate`), adapted to the inline `parseRSS`. Dropped A7: production already caps the cache at 256 entries. Left out demo fallback and response meta (b). |
| `src/app/api/rankings/route.ts` | a, b, c | Kept production's route. **Ported B3**: an empty result is now a failure, so it is not cached for 6 hours; production then serves stale cache or 500. Left out demo fallback and meta (b). |
| `src/app/api/health/sources/route.ts` | b | Left out. Makes four outbound probes per anonymous call, including an authenticated Mistral call outside production's model budget (main's A11). |
| `src/app/api/personalized-brief/route.ts` | b, c | Left out. A new paid Mistral endpoint that does not go through production's `modelFetch` budget. Main's A4 and A6 fixes live inside it, so they do not apply. |

### Pages and components

| Path | Class | Decision |
| --- | --- | --- |
| `src/app/compare/page.tsx` | a, b, c | Kept production's page (it queries Eurostat itself). **Ported C1, adapted**: indicators that failed and fell back to the built-in estimate are dropped, so an outage no longer shows "14 tied". Production has no snapshot data to fall back to, so a full outage now shows no rows instead of fake ones. |
| `src/app/stats/page.tsx` | b, c | Kept production's. C1 does not apply: production's stats page has no "Eurostat live" freshness badge (that badge is part of main's b features). |
| `src/components/ui/tabs.tsx` | b, c | **Ported C2** (`max-w-full overflow-x-auto scrollbar-hide` on the tab strip). Left out main's dark-mode tab colours (b). |
| `src/app/dashboard/page.tsx`, `src/app/feed/page.tsx`, `src/app/rankings/page.tsx` | b, c | Kept production's. C3 (`?demo=` forwarding) does not apply: demo mode is not live. Main's impact brief, source status panel, freshness badges and dark-mode classes (b) left out. |
| `src/app/ask/page.tsx` | b | Left out. Main buffers SSE lines across network chunks on the client and adds dark-mode classes. Untested in main (no DOM tests). Worth a follow-up: production's client can drop a token when a `data:` line is split across chunks. |
| `src/app/profile/page.tsx` | b | Left out. Priority themes and a "saved" toast. |
| `src/app/eu-life/page.tsx`, `src/app/globals.css` | b | Left out. Hero mesh styling, card spotlight, dark-mode colour overrides, personalization prop. |
| `src/components/CountrySelector.tsx`, `EUComparisonSection.tsx`, `Navigation.tsx` | b | Left out. Click-outside close, `next/image`, personalization ranking, scroll progress bar, dark-mode classes. All untested UI. |
| `src/app/layout.tsx` | a, b | Kept production's theme bootstrap (no stored theme follows the system). Left out main's `assertEnv()` call (b). |
| `src/app/error.tsx`, `src/app/manifest.ts`, `src/app/page.tsx` | a | Kept. Note: the manifest lists `/icon-192.png`, `/icon-512.png` and `/screenshot-wide.png`, which are not in the snapshot's `public/`. Unchanged here. |
| `src/components/ui/theme-toggle.tsx`, `src/lib/theme.ts` | a | Kept (theme defaults to `system`, read after mount). |

### Libraries, services, hooks, types

| Path | Class | Decision |
| --- | --- | --- |
| `src/lib/model-guard.ts`, `model-schema.ts`, `rss-loader.ts` | a | Kept. Production's quota, request validation and RSS fetching. |
| `src/lib/api-guard.ts` | b, c | Left out. Main's rate limiter and validators duplicate `model-guard`. **A2 dropped**: production keys its quota on `X-Real-IP`, which nginx overwrites, and never reads `X-Forwarded-For`. The ported tests pin this. |
| `src/lib/demo-mode.ts`, `src/data/demo/*.json` (4) | b, c | Left out, including C3's `withClientDemoParam`. |
| `src/lib/rss.ts` | b, c | Left out. Production parses RSS inline in the feed route; B2 was ported there. |
| `src/lib/env.ts`, `request-id.ts`, `source-registry.ts`, `personalization.ts` | b | Left out. |
| `src/lib/i18n.ts` | b | Left out (`normalizeLangCode`, unused by live code). |
| `src/lib/translations.ts` | a, b | Kept production's. Main adds keys for its own features. |
| `src/services/eurostat.ts` | a, b, c | Kept production's corrected Eurostat queries for median income (`statinfo=MED_EI`) and housing cost overburden (`rskpovth`, `unit=PC`). Left out source probes and test-only exports (b). C1's `partial` flag not ported: no live page reads it. |
| `src/services/eurostat-rankings.ts`, `src/services/api.ts`, `src/types/index.ts`, `src/hooks/useProfile.ts`, `src/hooks/useTranslatedIndicators.ts` | b | Left out. Source probes, priority-theme scoring and types, a stale-translation race fix (untested). |
| `src/services/scraper.ts` | a | Kept (production routes it through `modelFetch`). |
| `src/hooks/useSparklines.ts` | a | Kept. |

### Tests

| Path | Class | Decision |
| --- | --- | --- |
| `test/security.test.ts` | c | Ported, rewritten against production's guard: `X-Forwarded-For` rotation does not change quota identity or beat the 12-request client allowance (A2), 415 on `text/plain` (A3), oversized translate maps rejected with no Mistral call (A5), 502 without logging the question (A8), feed cache eviction (A7, at production's 256), Next at least 16.4.3 (A1). Main's personalized-brief cases dropped with the route. |
| `test/critical-paths.test.ts` | c | Ported: Ask EU prompt and validation, SSE reassembly in the stream route, rankings outage then recovery (B3). Main's `asAge`/`asCountryCode`, personalized-brief and demo cases dropped with their code. |
| `test/feed-scoring.test.ts`, `feed-numbered.test.ts`, `feed-dates.test.ts` | c | Main's feed tests (B1, B2, error contract), one scenario per file because production's RSS loader caches feeds for 30 minutes per process. Error contract adapted: production answers 502 when every source is down. |
| `test/flows.test.ts` | c | Not ported. Tests the `partial` flag (not ported, no consumer) and `withClientDemoParam` (demo mode). C1 on compare was verified in a browser instead, see below. |
| `test/contracts.test.ts`, `demo-mode.test.ts`, `parsers.test.ts`, `personalization.test.ts`, `smoke.test.ts` | b | Left out. They test main-only modules. |

## Quality-pass findings, one by one

| Finding | Outcome |
| --- | --- |
| A1 Next 16.1.6 advisories | Already live (16.4.3). Lockfile advisory bumps ported. |
| A2 rate limiter keyed on spoofable `X-Forwarded-For` | Dropped: production keys on nginx's `X-Real-IP`. |
| A3 cross-site `text/plain` POSTs | Dropped: production's `readJSON` answers 415. |
| A4 unbounded brief fields | Not applicable: route not live. |
| A5 unbounded translate keys | Dropped: production's schema rejects them. |
| A6 brief model output validation | Not applicable: route not live. |
| A7 unbounded feed cache | Dropped: production caps it at 256. |
| A8 Mistral error body logged, status forwarded | Dropped: `modelFetch` turns any non-ok upstream into a 502 and never reads the body. |
| B1 relevance scores discarded | **Ported** to `src/app/api/eu-feed/route.ts`. |
| B2 bad `pubDate` breaks the feed | **Ported**, adapted to the inline parser. |
| B3 empty rankings cached for 6 hours | **Ported** to `src/app/api/rankings/route.ts`. |
| C1 estimates labelled live | **Ported for compare** (adapted). Not applicable to stats (no such badge live). |
| C2 tab strip overflows at 375px | **Ported** to `src/components/ui/tabs.tsx`. |
| C3 `?demo=` not forwarded | Not applicable: demo mode not live. |

Counts: 6 ported (A1 lockfile, B1, B2, B3, C1, C2), 5 dropped because production already solves them differently (A2, A3, A5, A7, A8), 3 not applicable (A4, A6, C3).

## Dependencies

Production's versions are kept. Main's quality pass ran `npm audit fix`; these packages were moved by it for published advisories and production was still below, so the lockfile entries were copied from main (all patch or minor):

| Package | Production | Now | Advisory |
| --- | --- | --- | --- |
| `source-map-js` (runtime, via postcss) | 1.2.1 | 1.2.2 | GHSA-68fv-2mgg-jv7q |
| `flatted` (dev) | 3.3.3 | 3.4.4 | GHSA-25h7-pfq9-p65f, GHSA-rf6f-7fwh-wjgh |
| `js-yaml` (dev) | 4.1.1 | 4.3.2 | GHSA-h67p-54hq-rp68 and others |
| `brace-expansion` (dev) | 1.1.12 / 5.0.4 | 1.1.21 / 5.0.12 | GHSA-f886-m6hf-6m8v and others |
| `picomatch` under `tinyglobby` (dev) | 4.0.3 | 4.0.7 | GHSA-3v7f-55p6-f55p, GHSA-c2c7-rcm5-vvqj |
| `@humanfs/node` (dev) | 0.16.7 | 0.16.8 (with `@humanfs/core` 0.19.2, `@humanfs/types` 0.15.0) | GHSA-p498-v437-472g |

Not bumped: `nanoid` 3.3.19, `baseline-browser-mapping` 2.11.32 (main has newer, but `npm audit` flags neither at production's version). Added `tsx` 4.21.0 (dev, main's version) for the tests.

`npm audit --omit=dev`: production had 1 high (source-map-js); now 0. `npm audit`: production had 6 (1 moderate, 5 high); now 1 low, the esbuild dev-server advisory main also left open (A12).

## Lint

Production's own code fails `npm run lint` with 18 errors, all pre-existing:

- 10 in `src.bak-2026-09-09/` and `test-implementation.js`: these paths are now ignored.
- 8 in 7 deployed files (`react-hooks/set-state-in-effect`, one `react/no-unescaped-entities`): fixing them changes how those components render, which is out of scope. `eslint.config.mjs` lowers those two rules to warnings for exactly those 7 files. The source files are untouched.

Main avoided these errors by rewriting the same components, which is part of what was left out.

## Verification

All run on this branch after `npm ci`:

| Check | Result |
| --- | --- |
| `npm test` | 15 tests, 15 pass, 0 fail |
| `npm run lint` | 0 errors, 21 warnings |
| `npx tsc --noEmit` | clean |
| `npm run build` | success (Next 16.4.3, webpack) |

The B1, B2 and B3 tests fail against the unmodified snapshot (3 failures) and pass with the fixes.

C1 and C2 have no DOM test setup, so they were checked with headless Chromium against `next start`, with Eurostat mocked as down and as up, at 1280px and 375px:

| | Snapshot | This branch |
| --- | --- | --- |
| `/compare`, Eurostat down | "14 tied", 14 estimate rows | no scorecard, 0 rows |
| `/compare`, Eurostat up | 14 rows | 14 rows |
| `/stats` at 375px | 41px horizontal overflow | 0px |

React hydration error #418 shows on every page in both builds (main's C4, not fixed on main either).

`npm run test:security` is production's script and was left as is. It fails with `Cannot find module tests/model-security.cjs`: the `tests/` directory it points at is not in the snapshot. Restore those files from wherever they were written if that check matters.

## Deploy

Run from the directory the process manager starts the app in (the server's eu-hub directory). Copy single files over the existing ones. Do not replace or `rsync --delete` the directory: it holds `.env*`, the process manager config and `.model-budget/` (production's daily AI budget ledger), none of which are in git.

Files that changed against the live snapshot and must be copied:

```
package.json
package-lock.json
src/app/api/eu-feed/route.ts
src/app/api/rankings/route.ts
src/app/compare/page.tsx
src/components/ui/tabs.tsx
```

Optional, no runtime effect: `eslint.config.mjs`, `test/` (6 files), `RECONCILE.md`.

Steps:

```sh
cd /path/to/eu-hub                      # the app directory on the server

# 1. Back up what will change (keeps the current build for rollback)
tar czf ../eu-hub-pre-reconcile-$(date +%Y%m%d%H%M).tgz \
  package.json package-lock.json .next \
  src/app/api/eu-feed/route.ts src/app/api/rankings/route.ts \
  src/app/compare/page.tsx src/components/ui/tabs.tsx

# 2. Copy the six files above from this branch into place, keeping their paths

# 3. Install exactly the locked versions (dev dependencies are needed for the build)
npm ci

# 4. Build
npm run build

# 5. Restart under the process manager (use the app name from your pm2 config)
pm2 restart <app-name>
```

`npm ci` replaces `node_modules` while the old process is still serving, so do steps 3 to 5 back to back, ideally at a quiet time.

Rollback: extract the tarball over the directory, run `npm ci`, then `pm2 restart <app-name>` (the restored `.next` is the previous build, so no rebuild is needed).

## Left out, for the owner to decide

- Demo/snapshot mode, request ids, source health panel, personalized impact brief, priority themes.
- CSP header, `assertEnv` at startup.
- Dark-mode styling for most components, hero styling, navigation progress bar, country selector click-outside.
- Ask page client-side SSE buffering (a real but small bug in production; untested in main).
- `useTranslatedIndicators` stale-language race fix.

Each of these would need adapting to production's `model-guard` (anything that calls Mistral) and tests before it is safe to ship.
