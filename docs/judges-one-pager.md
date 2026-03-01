# EU Hub for Judges

## Problem
EU policy and data are public but too complex for everyday citizens. Most people do not know which regulations or statistics matter to their own life.

## Solution
EU Hub is a privacy-first personal EU intelligence layer:
- Live EU sources (Eurostat, EP, EC)
- Personalized ranking based on user context and selected priorities
- Mistral-powered plain-language explanation and actionable brief
- Explicit trust metadata (source, freshness, health)

## Technical Edge
- Multi-source ingestion with resilience and fallback.
- Visible provenance in API contracts and UI cards.
- Hybrid demo-safe mode for predictable presentations.
- Personalization engine that is explicit and user-controlled.

## Why Mistral Matters
- Personalized synthesis of policy and stats.
- Citizen-friendly summaries across EU contexts.
- Fast generation for demo-ready “impact brief” moments.

## Reliability Story
- Rate limiting + validation + timeout guards.
- Source health endpoint and degraded-state signaling.
- Snapshot fallback preserves full UX even during upstream/API outages.
