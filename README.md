# EU Hub

EU Hub is a privacy-first web app that turns EU policy and statistics into personal, actionable insights.

It combines live public EU data (Eurostat, European Parliament RSS, European Commission Press Corner) with Mistral-powered explanations and explicit trust metadata.

## What is unique

- **Trust layer**: source health, provenance, freshness, and last-update metadata in API + UI
- **Personalization 2.0**: user-controlled priority themes (cost of living, jobs, family, rights, climate, digital)
- **Wow moment**: one-click **My EU Impact Brief** with opportunities, risks, and weekly action
- **Hybrid demo-safe mode**: live-first with snapshot fallback for stable presentations

## Core Features

- Local-only profile personalization (no account required)
- Live EU feed with AI summaries and relevance ranking
- Real Eurostat stats with country vs EU comparisons
- Country rankings and head-to-head compare view
- EU vs world context cards with official references
- AI chat with streaming + fallback behavior
- Source health endpoint and dashboard panel

## Tech Stack

- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS 4
- Chart.js + react-chartjs-2
- Mistral API
- Eurostat public API

## Data Sources

- European Parliament RSS
- European Commission Press Corner RSS
- Eurostat API
- Curated EUR-Lex references for key policy context

## Security and Reliability

- Per-route in-memory rate limiting
- Input validation/normalization on API boundaries
- Upstream timeout wrappers
- Request correlation IDs (`x-request-id`)
- CSP + secure response headers
- Cache + stale-cache + snapshot fallback paths

## Getting Started

### Prerequisites

- Node.js 20+ (22 recommended)
- npm

### Install

```bash
npm install
```

### Run locally

```bash
cp .env.example .env.local
# add MISTRAL_API_KEY (optional for non-AI fallback flows)
npm run dev
```

### Quality checks

```bash
npm run check
```

## Environment Variables

- `MISTRAL_API_KEY` - enables AI routes/features
- `NEXT_PUBLIC_DEMO_MODE` - `off` | `hybrid` | `snapshot`

You can also force snapshot mode per request with query param: `?demo=1`.

## Scripts

- `npm run dev` - start dev server
- `npm run build` - production build
- `npm run start` - run production server
- `npm run lint` - ESLint
- `npm run test` - Node test runner
- `npm run check` - lint + test + build
- `npm run preflight` - production + security gate (`check` + audit + secret scan + demo fixtures)
- `npm run demo:snapshot` - refresh demo snapshot JSON files
- `npm run demo:ready` - refresh snapshots, then run full preflight

## GitHub Safety Checklist

- Keep `.env.local` local-only (`.env*` is gitignored by default).
- Put real keys only in runtime environment/hosting secrets.
- Run `npm run preflight` before every public push.
- If a key was ever exposed, rotate it immediately in provider dashboard.

## Key API Contracts

- `GET /api/eu-feed` -> returns feed + `meta` (freshness, source health, provenance)
- `GET /api/rankings` -> returns rankings + `meta` (coverage, methodology, freshness)
- `GET /api/health/sources` -> returns per-source status/latency/staleness
- `POST /api/personalized-brief` -> returns structured impact brief (AI or fallback)

## Documentation

- [Architecture](docs/architecture.md)
- [Demo Script](docs/demo-script.md)
- [Judges One-Pager](docs/judges-one-pager.md)
- [Contributing](CONTRIBUTING.md)

## Known Limitations

- Rate limits, cache, and source health are in-memory for single-instance deployment
- Some policy context content is curated and periodically refreshed
- FX conversion uses static approximations (not finance-grade)

## License

MIT (see `LICENSE`)
