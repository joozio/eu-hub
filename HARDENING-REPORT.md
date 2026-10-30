# EU Hub hardening report

Branch: `claude/eu-hub-security-hardening-1t5uvb`. Base: `faab401`.

| Phase | Commit |
| --- | --- |
| A. Security audit with fixes | `4402882` |
| B. Critical path tests | `3a9e8cd` |
| C. Broken user flows | `11fc267` |

## Summary

| Severity | Found | Fixed | Not fixed |
| --- | --- | --- | --- |
| HIGH | 2 | 2 | 0 |
| MEDIUM | 9 | 9 | 0 |
| LOW | 10 | 3 | 7 |
| **Total** | **21** | **14** | **7** |

Every fixed finding has a regression test that failed before the fix and passes after it. The two exceptions are layout and wiring fixes in client components (C2, plus the page side of C1 and C3). Those were verified with a headless browser walk instead, because the repo has no DOM test setup.

**Committed secrets:** none. I scanned all 5 commits in history for key, token and private-key patterns. `.env*` is gitignored except `.env.example`, which only holds placeholders.

**No paid API was called.** In every test, `MISTRAL_API_KEY` is a fake value and `fetch` is mocked.

## Test commands and results

| Command | Before (`faab401`) | After |
| --- | --- | --- |
| `npm test` | 12 tests, 12 pass, 0 fail | 36 tests, 36 pass, 0 fail |
| `npm run lint` | clean | clean |
| `npx tsc --noEmit` | not run before | clean |
| `npm run build` | not run before | success (Next 16.4.3) |
| `npm audit --omit=dev` | 1 critical, 4 high, 1 moderate (next, sharp, postcss, nanoid, source-map-js, baseline-browser-mapping) | 0 vulnerabilities |
| `npm audit` (incl. dev) | 15 (1 critical, 10 high, 2 moderate, 2 low) | 1 low (esbuild, see A12) |

New test files:

- `test/security.test.ts`: 8 tests (Phase A)
- `test/critical-paths.test.ts`: 14 tests (Phase B)
- `test/flows.test.ts`: 3 tests (Phase C)

Pre-existing failures: none. The baseline suite was green.

---

## Phase A: security audit

Scope I read: all 10 API routes, `middleware.ts`, `next.config.ts` (headers and CSP), `src/lib/api-guard.ts`, `env.ts`, `demo-mode.ts`, `request-id.ts`, `rss.ts`, `source-registry.ts`, the services, the client pages and hooks that call the API or render remote URLs, `package.json` and the lockfile, the scripts, and git history.

The app has no auth, sessions, payments, webhooks, file-path handling or subprocess calls. Its risk surface is: the paid Mistral API (cost), user profile data (privacy), and model or RSS output rendered in the UI.

### A1. HIGH. Vulnerable Next.js 16.1.6 (fixed, `4402882`)

- **Where:** `package.json:19` (`"next": "16.1.6"`).
- **Scenario:** the live Node process exposes the image optimizer (`/_next/image`, enabled through `images.remotePatterns` for flagcdn.com) and the App Router to unauthenticated users. Relevant advisories:
  - GHSA-3x4c-7xq6-9pq8: unbounded image disk cache growth. Varying `w` and `q` on `/_next/image` fills the disk.
  - GHSA-h64f-5h5j-jqjh and GHSA-q8wf-6r8g-63ch: image optimizer DoS.
  - GHSA-cjq9-62q9-8jv4: image optimizer SSRF.
  - GHSA-q4gf-8mx6-v5v3 and GHSA-8h8q-6873-q5fj: RSC DoS.
  - GHSA-4jqv-mc3x-m676, GHSA-mcj8-r9mp-w47p, GHSA-vfv6-92ff-j949 and GHSA-wfc6-r584-vfw7: cache poisoning.
  - Bundled sharp/libvips (GHSA-f88m-g3jw-g9cj) and postcss (GHSA-qx2v-qp2m-jg93).
- **Fix:** `next` 16.1.6 to 16.4.3. This is a minor bump within the same major, and the lowest release that clears `npm audit` (I checked 16.1.7, 16.2.12 and 16.3.8; none do). `npm audit fix` also made in-range lockfile updates:
  - GHSA-68fv-2mgg-jv7q (source-map-js)
  - GHSA-w5vr-8v7q-w6rv (baseline-browser-mapping)
  - GHSA-mrhx-c7xc-m3w5 (zod)
  - GHSA-28wg-ghj8-5hjv (nanoid)

  Every lockfile change is a minor or patch version; there are no major jumps.
- **Test:** `security.test.ts` checks that the installed next is at least 16.4.3. Build, lint, typecheck and a production `next start` smoke test pass on 16.4.3, and the middleware still sets `x-request-id`.

### A2. HIGH. Anyone can bypass the rate limiter, so Mistral spend is unbounded (fixed, `4402882`)

- **Where:** `src/lib/api-guard.ts:23-41` (formerly line 24, `getClientIp`).
- **Scenario:** the per-IP limiter keyed on the first `X-Forwarded-For` entry. A reverse proxy appends the real IP, so the first entry is whatever the client sent. `curl -H "X-Forwarded-For: $RANDOM" -X POST /api/chat ...` gets a fresh bucket on every request. That gave unlimited Mistral calls on the owner's key from one machine, and it also grew the bucket map without bound.
- **Fix:** use the last hop, which is the one added by the nearest proxy, or by Next itself when no header was sent. There is also an optional `TRUSTED_CLIENT_IP_HEADER` env var, documented in `.env.example`.
- **Test:** three requests with different spoofed prefixes and the same real hop get a 429 on the third.
- **Operator note:** if eu-hub.jock.pl sits behind Cloudflare in front of nginx, the last hop is a Cloudflare edge IP. Set `TRUSTED_CLIENT_IP_HEADER=cf-connecting-ip` in that case, or users behind one edge will share a bucket. I could not see the deploy topology (see "Could not verify").

### A3. MEDIUM. Cross-site pages can spend the Mistral quota through visitors' browsers (fixed, `4402882`)

- **Where:** all AI POST routes: `chat`, `chat/stream`, `dashboard-welcome`, `eu-comparison-insight`, `personalized-brief`, `translate-indicators`. See `src/lib/api-guard.ts:78`.
- **Scenario:** `req.json()` parses any body, so a third-party page could `fetch('https://eu-hub.jock.pl/api/chat', {method:'POST', body: JSON.stringify({...})})` with the default `text/plain` type. That is a CORS "simple request", so it gets no preflight. Every visitor's browser then spends quota from its own IP, which defeats per-IP limits.
- **Fix:** require `Content-Type: application/json` and answer 415 otherwise. That forces a preflight, which fails because no CORS headers are served. All in-app callers already send JSON.
- **Test:** text/plain POSTs to `/api/chat` and `/api/chat/stream` return 415, and Mistral is never called.

### A4. MEDIUM. `/api/personalized-brief` forwards unbounded strings to Mistral (fixed, `4402882`)

- **Where:** `src/app/api/personalized-brief/route.ts:32` (`asProfile`), plus `asStatArray` and `asFeedArray`.
- **Scenario:** profile, stat and feed string fields had no length cap, and `country` and `priorityThemes` were not validated. A single request with 200k-char fields made a **12,001,557-char** Mistral request (measured in the test before the fix). That is a paid, billed prompt per call.
- **Fix:** every field is now bounded and validated with the existing `asTrimmedString`, `asCountryCode` and `asAge` helpers. URLs must be http(s), and themes are de-duplicated.
- **Test:** the same request now produces a Mistral payload under 20k chars.

### A5. MEDIUM. `/api/translate-indicators` forwards any number of keys to Mistral (fixed, `4402882`)

- **Where:** `src/app/api/translate-indicators/route.ts:15` (`sanitizeStringMap`).
- **Scenario:** 5,000 label and hint keys made a **3,688,525-char** prompt (measured before the fix).
- **Fix:** keep at most 64 keys, and only keys shaped like indicator ids (`/^[a-z0-9_]{1,40}$/`). The real client sends 19.
- **Test:** the payload stays under 40k chars, and legitimate keys still go through.

### A6. MEDIUM. Model JSON is passed unvalidated to the dashboard (fixed, `4402882`)

- **Where:** `src/app/api/personalized-brief/route.ts:103-130` and `:259`. Formerly `sections: parsed.sections` and `citations: parsed.citations`.
- **Scenario:** the prompt does not fix the section shape, so Mistral can return e.g. `{"sections":[{"title":"..","content":".."}]}`. The dashboard calls `section.items.map` (`src/app/dashboard/page.tsx`), which throws, and the dashboard crashes into the error boundary. Item objects instead of strings crash React the same way. Citation `url` values were rendered as `<a href>` with any scheme. The prompt includes feed titles that come from third-party RSS, so prompt-injected `data:` or off-site phishing links were possible. React 19 does neutralise `javascript:` URLs.
- **Fix:** sections must be `{title: string, items: string[]}`. Citations must be http(s). If nothing valid remains, the deterministic fallback is used.
- **Test:** malformed sections and `javascript:` and `data:` citations produce only well-formed sections and https links.

### A7. MEDIUM. The feed cache grows without limit (fixed, `4402882`)

- **Where:** `src/app/api/eu-feed/route.ts:26-39`.
- **Scenario:** the cache key includes the free-text `employmentStatus`, `industry` and `housingStatus` query params, and entries were never evicted. Looping `GET /api/eu-feed?country=PL&employmentStatus=<random>` stores about 15 items per key forever, and each new key also triggers a paid Mistral scoring call. The Node process's memory grows until it is OOM-killed.
- **Fix:** cap the cache at 500 entries and evict the oldest first.
- **Test:** after 601 distinct keys, the first key is evicted (served `live`, not `cached`).

### A8. LOW. Mistral error bodies were logged, and upstream status codes were forwarded (fixed, `4402882`)

- **Where:** `src/app/api/chat/route.ts:99-101`. Also `dashboard-welcome:94`, `eu-comparison-insight:85` and `chat/stream:106,113`.
- **Scenario:** `/api/chat` logged the raw Mistral error body. Validation-style error bodies can echo the request input, which is the user's question, into server logs. All AI routes also forwarded Mistral's status (e.g. 401 when the key is revoked) to anonymous clients.
- **Fix:** log the status only, and answer 502.
- **Test:** a mocked 401 whose body echoes the question returns 502, and the question never reaches `console.error`.

### A9. LOW. The browser calls Eurostat directly (not fixed)

- **Where:** `src/hooks/useSparklines.ts:59`, and `src/services/eurostat.ts` when loaded client-side by stats, compare and dashboard.
- **Scenario:** opening `/stats` sends the user's IP and selected country to `ec.europa.eu` from their browser. The CSP `connect-src` explicitly allows this, so it is a deliberate design.
- **Why not fixed:** a fix means a new server-side proxy route with caching. That changes the data flow and upstream load of the live product, which is an architectural decision for the owner. The data sent is a country code to an EU institution.

### A10. LOW. Profile data in GET query strings (not fixed)

- **Where:** `src/app/feed/page.tsx:57` and `src/app/dashboard/page.tsx:117,125` call `/api/eu-feed?country=..&age=..`.
- **Scenario:** reverse-proxy access logs record country and age next to the client IP.
- **Why not fixed:** a fix changes the public API contract (GET to POST) of a live product. Only country and age travel this way; the richer fields do not.

### A11. LOW. `/api/health/sources` triggers four outbound probes per anonymous call, including an authenticated Mistral call (not fixed)

- **Where:** `src/app/api/health/sources/route.ts:21-28`.
- **Scenario:** at 20 calls per minute per real IP, this is a small amplification. The dashboard depends on it.
- **Why not fixed:** low impact now that A2 makes the limit real. A short server-side cache of probe results would remove it.

### A12. LOW. esbuild dev-server advisory GHSA-g7r4-m6w7-qqqr (not fixed)

- **Where:** a dev dependency of `tsx`.
- **Why not fixed:** it only affects the esbuild dev server on Windows. It is not in the production bundle, and `npm audit fix` cannot resolve it within tsx's range.

### Hardening ideas (no concrete failure scenario, report only)

- `middleware.ts:4` echoes a client-supplied `x-request-id` unvalidated. It is not logged today. Validate its format before ever logging it.
- `next.config.ts:10-11` uses CSP `script-src 'unsafe-inline'`, needed for the theme bootstrap script in `layout.tsx`. A nonce or hash would tighten it.
- `src/lib/api-guard.ts:16` only sweeps rate-limit buckets once there are 5,000 of them, and the limits are per process. If the app ever runs more than one process, limits multiply.
- `src/app/api/chat/stream/route.ts:121`: the stream has no `cancel()`, so a client disconnect does not abort the upstream Mistral stream (tokens are still billed).
- `src/services/scraper.ts:196` has the same score-parsing regex bug as B1. The file is not imported anywhere, so I left it alone.

---

## Phase B: critical paths

Paths pinned in `test/critical-paths.test.ts`:

1. **Ask EU** (the main AI feature): the profile and language prompt, request validation, SSE reassembly when upstream splits a `data:` line across chunks, the `[DONE]` terminator, and per-client 429 with `Retry-After`.
2. **Live feed:** one source down while the other still serves, Mistral scoring and sort order, numbered model output, the invalid-country 400, the all-sources-down error contract, and the hybrid snapshot fallback.
3. **Impact brief:** the AI path with well-formed output, and the deterministic fallback on a Mistral 500, junk output, or a thrown error.
4. **Rankings:** outage handling and recovery.
5. **Input normalisation** (`asAge`, `asCountryCode`), which every route relies on.

### B1. MEDIUM. Mistral relevance scores were silently discarded, so AI feed ranking never worked (fixed, `3a9e8cd`)

- **Where:** `src/app/api/eu-feed/route.ts:147`.
- **Scenario:** the "strip numbering" regex `/^\d+\.\s*/` also matched the score itself. `0.2|summary` became `2|summary`, which was clamped to 1.0. `1.0|...` became `0|...`, a score of 0. Every item got the same score, so the personalised ordering the product promises never applied.
- **Fix:** only strip `N. ` or `N) ` numbering that is followed by whitespace.
- **Tests:** scores 0.2 and 0.9 come back unchanged and sort correctly (this failed before the fix). A second test checks that numbered lines still parse.

### B2. MEDIUM. One malformed `<pubDate>` took down the whole feed (fixed, `3a9e8cd`)

- **Where:** `src/lib/rss.ts:24-25`.
- **Scenario:** `new Date('garbage').toISOString()` throws `RangeError`. `parseRssItems` runs outside the per-source `allSettled`, so a single bad item in the European Parliament RSS failed both sources. Users got the error state, or a stale or snapshot feed.
- **Fix:** fall back to today's date.
- **Tests:** a unit test, plus a route test with a broken date in one feed (both failed before the fix).

### B3. MEDIUM. A Eurostat outage cached an empty ranking as "live" for 6 hours (fixed, `3a9e8cd`)

- **Where:** `src/app/api/rankings/route.ts:63`.
- **Scenario:** `fetchAllRankings` swallows per-indicator failures, so a full outage resolved to `{indicators: []}` instead of throwing. The route cached that as `live` for 6 hours. It skipped the stale cache, skipped the hybrid snapshot, and returned 200 with an empty page even after Eurostat recovered.
- **Fix:** treat an empty result as a failure.
- **Test:** the outage gives 500 in `off` mode and a snapshot in `hybrid` mode, and the next request after recovery is served live (this failed before the fix).

---

## Phase C: broken user flows

**Method:** `npm run build` and `next start`, then headless Chromium (Playwright) through:

- landing, then country picker and age, then "Show me what matters", then dashboard
- feed, stats, rankings, compare, EU life, Ask EU (submitting a question), the profile form save, the impact brief button, and 404

I ran this at 1280px and 375px, both live (upstreams unreachable from the sandbox, so error paths were exercised) and with `?demo=1`. For every page I checked for a crash or error boundary, horizontal page overflow and console errors.

**What works:**

- Onboarding, profile save and redirect.
- The Ask EU error message when the AI is unavailable.
- The impact brief fallback.
- 404.
- No error boundary was hit on any page.

### C1. MEDIUM. Built-in estimates were labelled "Eurostat live" (fixed, `11fc267`)

- **Where:** `src/services/eurostat.ts:350-362`, `src/app/stats/page.tsx:140-141` and `src/app/compare/page.tsx:71`.
- **Repro:** with Eurostat unreachable, open `/stats` and `/compare`.
  - Stats showed the badge "Eurostat live / live" and country values equal to the EU average.
  - Compare showed "Poland 0 : France 0, 14 ties" with every value identical, badged `live`.
- **Cause:** `fetchRealEurostatData` fills failed indicators with the same hard-coded estimate for every country. `fetchWithEUComparison` dropped its `partial` flag, so pages could not tell.
- **Fix:**
  - Propagate `partial`.
  - Stats shows "Eurostat fallback / snapshot" when partial.
  - Compare drops estimate rows (rows without data are already hidden) and falls back to its existing snapshot path when nothing real remains.
- **Tests:** `flows.test.ts` checks that the outage gives `partial: true` and success gives `partial: false` (both failed before the fix). The UI labels were re-verified in the headless walk.

### C2. LOW. Horizontal page scroll at 375px on stats and compare (fixed, `11fc267`)

- **Where:** `src/components/ui/tabs.tsx:43`.
- **Repro:** at 375px, `/stats` overflowed by 41px and `/compare` by 97px. The tab strip was wider than the viewport and the last tab ("Społeczeństwo") was clipped.
- **Fix:** `max-w-full overflow-x-auto scrollbar-hide` on `TabsList`, so the strip scrolls instead of the page.
- **Verification:** re-measured at 0px overflow on every page. No automated test: there is no DOM test setup in the repo.

### C3. LOW. The README's `?demo=1` "fallback continuity" flow was broken on rankings, feed and dashboard (fixed, `11fc267`)

- **Where:** `src/lib/demo-mode.ts:35`, `src/app/rankings/page.tsx:49`, `src/app/feed/page.tsx:58`, and `src/app/dashboard/page.tsx` (feed and brief calls).
- **Repro:** open `/rankings?demo=1` with Eurostat unreachable. The page called `/api/rankings` without the flag and showed "Error". The feed had no live items.
- **Fix:** a `withClientDemoParam` helper forwards the page's demo flag to the API calls.
- **Verification:** a unit test in `flows.test.ts`, plus the headless walk, where rankings shows SNAPSHOT with 97.7% coverage and the feed shows snapshot items.

### C4. LOW. React hydration error #418 on every page (not fixed)

- **Where:** `src/hooks/useProfile.ts:12`. `useState` reads `localStorage` during the first client render, so the client text differs from the server HTML.
- **Impact:** React recovers by client-rendering, so the page works. It costs a re-render and a console error.
- **Why not fixed:** a correct fix changes how the profile hydrates on every page. Simply moving the read into an effect would make the feed, stats and rankings pages redirect to `/` before the profile loads, which would break them. This needs a deliberate change, e.g. `useSyncExternalStore` plus a loading state.

### C5. LOW. Dashboard key stats show estimates without a marker during a Eurostat outage (not fixed)

- **Where:** `src/app/dashboard/page.tsx:105-110`.
- **Why not fixed:** the dashboard has no freshness badge on those cards. Its source-status panel already shows Eurostat as down. Adding a marker is a UI copy decision. The `partial` flag from C1 is now available to drive one.

### C6. LOW. Dead copy of the B1 regex bug in `src/services/scraper.ts:196` (not fixed)

- **Why not fixed:** the module is not imported anywhere.

---

## Could not verify

- **Live upstreams:** Eurostat, the EP and EC RSS feeds, Mistral and flagcdn are all unreachable from this sandbox. All upstream behaviour was mocked or run in snapshot mode. Flag images rendered as broken in the walk for the same reason.
- **Real Mistral output shapes:** A6 and B1 were reproduced with plausible mocked outputs, not with captured production responses.
- **Deploy topology:** I could not see whether eu-hub.jock.pl uses nginx, Caddy or Cloudflare (a header-only request to the site was blocked by the sandbox proxy). The A2 default is correct for a single appending or overwriting proxy, or direct exposure without a client-sent header. Behind Cloudflare, set `TRUSTED_CLIENT_IP_HEADER`.
- **Next 16.4.3 on the production host:** verified only by local build, tests and `next start`. Deploy to staging first.
- **The profile "is a parent" toggle:** the walk script could not check it. It is likely a custom control, and I did not confirm whether it works.
