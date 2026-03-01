# EU Hub - Hackathon Improvement Plan

**Goal:** Make EU Hub genuinely useful for EU citizens. Real data, local language, personalized.
**Constraint:** No paid API integrations beyond Mistral. Use public data + Firecrawl (open source) for scraping.
**Hackathon rule:** Can use open-source projects (Firecrawl qualifies).

---

## Priority 1: Multi-Language UI (KILLER DEMO FEATURE)

When a user selects their country, the entire app switches to that country's language.

### How it works:
1. **Country → Language mapping** (e.g., PL → Polish, DE → German, ES → Spanish)
2. **Static UI translations** - ~40 UI strings (nav labels, buttons, headings, placeholders) translated via a single Mistral batch call at build time, stored as JSON
3. **Dynamic content translation** - Mistral translates feed summaries, AI responses, and insights into the user's language on the fly (already calling Mistral for summaries, just add language instruction)
4. **`<html lang>` updates** dynamically based on selected country
5. **Chat in local language** - User asks questions in their language, Mistral responds in that language

### Country → Language Map:
```
AT→de, BE→fr, BG→bg, HR→hr, CY→el, CZ→cs, DK→da, EE→et,
FI→fi, FR→fr, DE→de, GR→el, HU→hu, IE→en, IT→it, LV→lv,
LT→lt, LU→fr, MT→en, NL→nl, PL→pl, PT→pt, RO→ro, SK→sk,
SI→sl, ES→es, SE→sv
```

### Implementation steps:
1. Create `src/lib/i18n.ts` with country→language map + UI string keys
2. Create `src/lib/translations.ts` with pre-generated translations for all 24 EU languages (generate once with Mistral, commit as static JSON)
3. Create `useLanguage()` hook that derives language from profile country
4. Wrap all UI strings with `t('key')` translation function
5. Update Mistral prompts in `/api/eu-feed` and `/api/chat` to include `Respond in {language}` instruction
6. Update `<html lang>` in layout based on profile

### Files to modify:
- `src/lib/i18n.ts` (NEW) - language config + translation function
- `src/lib/translations.ts` (NEW) - static translation strings
- `src/hooks/useProfile.ts` - add language to profile
- `src/app/layout.tsx` - dynamic `<html lang>`
- `src/app/page.tsx` - translate landing page
- `src/app/feed/page.tsx` - translate feed UI
- `src/app/stats/page.tsx` - translate stats UI
- `src/app/ask/page.tsx` - translate chat UI
- `src/components/Navigation.tsx` - translate nav
- `src/app/api/eu-feed/route.ts` - add language to Mistral prompt
- `src/app/api/chat/route.ts` - respond in user's language
- `src/app/api/chat/stream/route.ts` - respond in user's language

---

## Priority 2: More Real Data via Firecrawl (Open Source)

Currently: EP + EC RSS feeds (press releases only). Need more content types.

### Data sources to scrape:
1. **EUR-Lex Recent Acts** - `https://eur-lex.europa.eu/oj/direct-access.html` (Official Journal, latest legislation)
2. **European Council conclusions** - `https://www.consilium.europa.eu/en/press/press-releases/` (policy decisions)
3. **Country-specific EU pages** - Each country has a representation page, e.g. `https://ec.europa.eu/info/about-european-commission/contact/representations-member-states_en`

### How to use Firecrawl:
- Use Firecrawl open-source self-hosted or the npm package
- Create a scraping service that runs server-side in Next.js API routes
- Cache scraped data with Next.js revalidation (1-2 hour TTL)
- Feed scraped content through Mistral for relevance scoring + translation

### Implementation steps:
1. Add `firecrawl` or use direct HTTP scraping in a new service file
2. Create `src/services/scraper.ts` - scrape EUR-Lex OJ, Council conclusions
3. Create `/api/eu-data/route.ts` - API endpoint that merges RSS + scraped data
4. Merge scraped items into the feed alongside existing RSS items
5. Use Mistral to score + summarize all items (already have this pattern)

### Files to create/modify:
- `src/services/scraper.ts` (NEW) - Firecrawl-based scraping
- `src/app/api/eu-feed/route.ts` - merge scraped data into feed

---

## Priority 3: Wire Up Profile Fields (QUICK WIN)

Profile page already collects: employment status, industry, housing status, parent status.
None of this data is used. Wire it into relevance scoring and Mistral context.

### Implementation steps:
1. Update `useProfile()` to read all profile fields from localStorage
2. Update relevance scoring in `api.ts` to use employment/industry/housing/parent
3. Pass full profile to Mistral in feed scoring + chat context
4. Add profile-based suggested questions in Ask page

### Scoring logic:
- **Employment: unemployed** → boost Youth Guarantee, employment legislation
- **Industry: technology** → boost AI Act, Chips Act, DMA, DSA
- **Industry: energy/environment** → boost Green Deal, Net-Zero Act
- **Housing: renting** → boost housing-related stats, tenant rights
- **Parent: true** → boost education, family policy, childcare legislation
- **Employment: self-employed** → boost CSRD, business regulations

### Files to modify:
- `src/hooks/useProfile.ts` - return full UserProfile
- `src/services/api.ts` - enhanced relevance scoring
- `src/app/api/eu-feed/route.ts` - pass profile to Mistral
- `src/app/api/chat/route.ts` - include profile in system prompt
- `src/app/ask/page.tsx` - profile-aware suggested questions

---

## Priority 4: Demo Polish

### Quick wins for hackathon presentation:
1. **Loading states** - skeleton cards instead of spinner
2. **Empty states** - helpful messages when no data matches
3. **Error recovery** - retry buttons, graceful degradation messages
4. **Stats page** - show country flag + name prominently in local language
5. **Mobile polish** - test on phone-sized screens
6. **Landing page** - show a preview of what the feed looks like before you sign up

---

## Execution Order

| Step | What | Effort | Impact |
|------|------|--------|--------|
| 1 | Wire up profile fields (Priority 3) | 30 min | Medium |
| 2 | i18n system + translations (Priority 1) | 2-3 hours | HUGE |
| 3 | Firecrawl data enrichment (Priority 2) | 1-2 hours | High |
| 4 | Demo polish (Priority 4) | 30 min | Medium |

**Total estimated: 4-6 hours of implementation**

---

## What NOT to do (cut from original plan)

- ~~User authentication~~ - Not needed for hackathon. localStorage is fine.
- ~~Supabase/database~~ - Overkill. No persistent state needed.
- ~~Redis caching~~ - Next.js built-in revalidation is enough.
- ~~OAuth 2.0~~ - No user accounts = no auth needed.
- ~~Service workers~~ - Offline mode is irrelevant for a demo.
- ~~EUR-Lex REST API~~ - Doesn't exist as described. Use scraping.
- ~~Europa Newsroom API~~ - Doesn't exist. Use RSS + scraping.
- ~~App store submission~~ - It's a web app for a hackathon.
