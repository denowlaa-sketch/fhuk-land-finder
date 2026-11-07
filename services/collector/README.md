# FHUK collector

Python worker: multi-region UK keywords (GM + West Yorkshire / Merseyside / Lancashire / Cheshire / West Midlands) → pluggable public web search → OpenAI extract/score → URL/content-hash dedupe → Postgres.

Region selection: `COLLECTOR_REGION=all` (default) or a slug / comma list (`greater-manchester`, `west-yorkshire`, …). `fhuk-collector keywords --region west-yorkshire` expands one library.

## Providers

| Provider | Needs | Notes |
| -------- | ----- | ----- |
| `auto` | — | google → bing → recorded |
| `google` | `GOOGLE_CSE_API_KEY`, `GOOGLE_CSE_CX` | Custom Search JSON API |
| `bing` | `BING_SEARCH_API_KEY` | Bing Web Search v7 |
| `reddit` | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT` | Official OAuth; else recorded sample |
| `forums` | — | Light UK property/self-build forum recorded threads |
| `classifieds` | — (optional CSE keys if live) | Gumtree + Preloved + Freeads |
| `gumtree` / `preloved` / `freeads` | — | Per-site classifieds |
| `auctions` | — (optional CSE keys if live) | Auction House + SDL + EG + Plotfinder + PlotBrowser |
| `auctionhouse` / `sdl` / `eg` / `plotfinder` / `plotbrowser` | — | Per-site auctions / specialist plots |
| `recorded` | — | Offline `samples/search/google_cse_gm.json` |
| `fixtures` | — | Repo `fixtures/` with full post text |
| `stub` | — | Synthetic `example.invalid` URLs |

No unofficial Facebook scrapers. Reddit/forums/classifieds/auctions are **explicit** providers (not selected by `auto`).

## Classifieds (Gumtree / Preloved / Freeads)

**Default = offline recorded samples** (`samples/search/classifieds_gm.json`) with private landowner-style ads and an agent-spam filter.

**Live (optional):** set `CLASSIFIEDS_LIVE=true` plus `GOOGLE_CSE_API_KEY` / `GOOGLE_CSE_CX`. Uses Google CSE `site:gumtree.com` (etc.) queries only — **no HTML scrape** of classified listing pages (brittle / ToS-sensitive).

```bash
# Offline smoke
fhuk-collector run --provider classifieds --limit-queries 8
fhuk-collector run --provider gumtree --limit-queries 5
fhuk-collector run --provider preloved --limit-queries 5
fhuk-collector run --provider freeads --limit-queries 5

# Persist when Postgres is ready
fhuk-collector run --provider classifieds --write
```

## Auctions + specialist land

**Default = offline recorded samples** (`samples/search/auctions_gm.json`) with GM/UK land auction lots and specialist plot ads. Residential house-lot noise is filtered.

**Live (optional):** set `AUCTIONS_LIVE=true` plus `GOOGLE_CSE_API_KEY` / `GOOGLE_CSE_CX`. Uses Google CSE `site:auctionhouse.co.uk` (etc.) queries only — **no HTML scrape** of auction/plot catalogue pages.

```bash
# Offline smoke
fhuk-collector run --provider auctions --limit-queries 8
fhuk-collector run --provider auctionhouse --limit-queries 5
fhuk-collector run --provider sdl --limit-queries 5
fhuk-collector run --provider plotfinder --limit-queries 5

# Persist when Postgres is ready
fhuk-collector run --provider auctions --write
```

## Commands

```bash
cd services/collector
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

fhuk-collector providers
fhuk-collector keywords

# Offline smoke (no search API keys)
fhuk-collector run --provider recorded --limit-queries 10
fhuk-collector run --provider reddit --limit-queries 8
fhuk-collector run --provider forums --limit-queries 6
fhuk-collector run --provider classifieds --limit-queries 8
fhuk-collector run --provider auctions --limit-queries 8

# Live Reddit when OAuth app credentials are set
fhuk-collector run --provider reddit --limit-queries 5 --write

# Live Google/Bing when keys are set
fhuk-collector run --provider google --limit-queries 5 --write
fhuk-collector run --provider bing --limit-queries 5 --write
```

## Google CSE env (collector host — not Vercel)

```bash
GOOGLE_CSE_API_KEY=...   # Cloud Console API key with Custom Search JSON API
GOOGLE_CSE_CX=...        # Programmable Search engine ID
```

1. Enable **Custom Search JSON API** and create an API key.
2. Create a [Programmable Search Engine](https://programmablesearchengine.google.com/) (entire web is fine; classifieds/auctions add `site:` in-query).
3. Copy the search engine ID into `GOOGLE_CSE_CX`.
4. Smoke: `fhuk-collector run --provider google --limit-queries 3` then `--write` with `DATABASE_URL` to fill Discovery.

`SEARCH_PROVIDER=auto` selects Google when both vars are set. `fhuk-collector providers` prints `live_readiness.google_cse`.

## Reddit env (collector host — not Vercel)

```bash
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...
REDDIT_USER_AGENT=fhuk-land-finder/0.1 (by your-reddit-username)
REDDIT_SUBREDDITS=SelfBuild,HousingUK,manchester,leeds,Liverpool,birmingham,UKProperty,AskUK
REDDIT_ALLOW_PUBLIC_JSON=false
```

Create a Reddit “script” or “web” app at https://www.reddit.com/prefs/apps and use client credentials grant. Without id+secret, Reddit **silently** replays `samples/search/reddit_gm.json`. Check `fhuk-collector providers` → `live_readiness.reddit_oauth`.

## Facebook paste (no scrape)

```bash
# Hypothetical fixture
fhuk-collector analyze-paste --fixture ../../fixtures/facebook/02-fb-rumour-stockport.json

# Manual paste — URL is metadata only (never fetched)
fhuk-collector analyze-paste --url 'https://www.facebook.com/…' --text '…pasted post…'
fhuk-collector analyze-paste --fixture ../../fixtures/facebook/01-fb-bolton-garden.json --write
```

## Email notifications (Strong / Investigate)

```bash
# Log-only (no SMTP / API keys needed)
NOTIFY_EMAIL_ENABLED=true NOTIFY_EMAIL_TO=you@example.com NOTIFY_EMAIL_MODE=dry-run \
  fhuk-collector run --provider recorded --limit-queries 5 --write

# Live SMTP example
NOTIFY_EMAIL_ENABLED=true NOTIFY_EMAIL_MODE=send NOTIFY_EMAIL_PROVIDER=smtp \
  NOTIFY_EMAIL_TO=you@example.com SMTP_HOST=smtp.example.com SMTP_USER=… SMTP_PASSWORD=… \
  fhuk-collector analyze-paste --fixture ../../fixtures/facebook/01-fb-bolton-garden.json --write
```

Reject leads never email. Updates to an existing URL do not re-notify.

## Samples

- `samples/search/google_cse_gm.json` — recorded CSE-shaped payload
- `samples/search/bing_gm.json` — Bing-shaped reference sample
- `samples/search/reddit_gm.json` — recorded Reddit-style GM land posts
- `samples/search/uk_forums_gm.json` — light UK forum recorded threads
- `samples/search/classifieds_gm.json` — Gumtree / Preloved / Freeads GM ads
- `samples/search/auctions_gm.json` — UK auction / Plotfinder / PlotBrowser GM land lots
- `../../fixtures/facebook/*.json` — hypothetical Facebook paste fixtures
