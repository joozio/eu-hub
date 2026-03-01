# EU Hub

EU Hub is a privacy-first personal intelligence layer for the European Union.

It combines live EU public data with AI explanations to answer one practical question:
what EU policy changes matter to this specific person right now?

## Why this project stands out

- Trust-first UX: every major view surfaces freshness, source, and health metadata.
- Personalization that is explicit: users choose priorities and see why content is relevant.
- Live-safe demo mode: the app is resilient even if upstream APIs or AI fail.
- Action-oriented AI output: "My EU Impact Brief" gives opportunities, risks, and one weekly action.

## Product scope

- Personalized dashboard with source health panel.
- EU news feed from official RSS sources with AI summaries.
- Eurostat-powered stats and cross-country comparisons.
- Rankings for all 27 EU countries by indicator.
- "EU vs rest of world" context cards with official references.
- Ask EU chat with streaming and fallback behavior.

## Architecture at a glance

- Frontend and backend: Next.js 16 App Router.
- Data connectors: Eurostat API, European Parliament RSS, EC Press Corner RSS.
- AI: Mistral API with deterministic fallback when unavailable.
- Personalization: local-first profile and scoring in browser storage.
- Resilience: timeout guards, cache/stale/snapshot fallback, source health tracking.
- Security: CSP headers, input normalization, route guards, correlation IDs.

## Demo-ready workflow

1. Create profile and select priority themes.
2. Open dashboard and show health/freshness indicators.
3. Trigger "My EU Impact Brief".
4. Open feed/stats/rankings and point to official provenance.
5. Show fallback continuity with `?demo=1`.

Detailed demo narrative:
- [Demo Script](docs/demo-script.md)
- [Judges One-Pager](docs/judges-one-pager.md)

## Quick start

### Prerequisites

- Node.js 20+ (Node 22 recommended)
- npm

### Install and run

```bash
npm install
cp .env.example .env.local
# optional: set MISTRAL_API_KEY for AI features
npm run dev
```

### Production and demo preflight

```bash
npm run preflight
```

This runs:
- lint + tests + production build
- dependency audit (high severity gate)
- credential-pattern scan
- demo snapshot fixture verification

For judging day:

```bash
npm run demo:ready
```

This refreshes snapshots and then runs full preflight.

## Environment variables

- `MISTRAL_API_KEY`: enables AI routes and summaries.
- `NEXT_PUBLIC_DEMO_MODE`: `off` | `hybrid` | `snapshot`.

You can force snapshot mode per request with `?demo=1`.

## Data sources

- Eurostat API
- European Parliament RSS
- European Commission Press Corner RSS
- Curated EUR-Lex references for policy context

## API contract highlights

- `GET /api/eu-feed`: feed plus freshness/source health metadata.
- `GET /api/rankings`: rankings plus methodology and coverage metadata.
- `GET /api/health/sources`: per-source status, latency, and staleness.
- `POST /api/personalized-brief`: structured impact brief (AI or fallback).

## Security and key hygiene

- `.env*` is gitignored by default.
- Do not commit live API keys.
- Use environment secrets in hosting provider for production.
- Run `npm run preflight` before public pushes.
- Rotate keys immediately if exposure is suspected.

## Documentation

- [Architecture](docs/architecture.md)
- [Demo Script](docs/demo-script.md)
- [Judges One-Pager](docs/judges-one-pager.md)
- [Contributing](CONTRIBUTING.md)

## License

MIT, see [LICENSE](LICENSE).
