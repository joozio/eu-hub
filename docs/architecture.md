# EU Hub Architecture

## Overview
EU Hub is a Next.js App Router application that combines live EU sources (Eurostat, EP RSS, EC Press Corner) with Mistral-generated explanations and personalization.

## Data Flow
1. Client pages request server API routes in `src/app/api/*`.
2. API routes fetch upstream data with timeout + rate limiting (`src/lib/api-guard.ts`).
3. Source health is tracked in-memory (`src/lib/source-registry.ts`).
4. Routes return payloads with provenance and freshness metadata.
5. UI renders both content and trust metadata (source, freshness, last update).

## Personalization
- User profile is stored in localStorage (`userProfile`).
- Priority themes are user-selected and used in relevance scoring (`src/lib/personalization.ts`).
- No account is required; profile remains local by default.

## Demo Mode
- Controlled by `NEXT_PUBLIC_DEMO_MODE` and `?demo=` query param.
- Modes:
  - `off`: live only
  - `hybrid`: live first, snapshot fallback
  - `snapshot`: force snapshot
- Snapshot files are stored under `src/data/demo`.

## Reliability and Safety
- Input normalization on all core APIs.
- In-memory rate limits per route/IP.
- Upstream timeout wrappers.
- Stale cache fallback and demo snapshot fallback.
- CSP and security headers configured in `next.config.ts`.
- `x-request-id` correlation IDs via middleware.

## Important APIs
- `GET /api/eu-feed`
- `GET /api/rankings`
- `GET /api/health/sources`
- `POST /api/personalized-brief`
- `POST /api/chat` and `POST /api/chat/stream`
