# Contributing

## Setup
1. `npm install`
2. `cp .env.example .env.local`
3. Add `MISTRAL_API_KEY` (optional for non-AI flows)
4. `npm run dev`

## Quality Gate
Run before opening PR:

```bash
npm run check
```

## Snapshot Refresh (demo mode)

```bash
npm run demo:snapshot
```

## Coding Notes
- Keep personalization local-first.
- Preserve trust metadata (`source`, `freshness`, `generatedAt`) in API responses.
- When adding external connectors, register them in `src/lib/source-registry.ts`.
