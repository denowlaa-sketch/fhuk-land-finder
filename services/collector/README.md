# FHUK collector

Python worker: Greater Manchester keywords → pluggable public web search → OpenAI extract/score → URL/content-hash dedupe → Postgres.

## Providers

| Provider | Needs | Notes |
| -------- | ----- | ----- |
| `auto` | — | google → bing → recorded |
| `google` | `GOOGLE_CSE_API_KEY`, `GOOGLE_CSE_CX` | Custom Search JSON API |
| `bing` | `BING_SEARCH_API_KEY` | Bing Web Search v7 |
| `reddit` | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT` | Official OAuth; else recorded sample |
| `forums` | — | Light UK property/self-build forum recorded threads |
| `recorded` | — | Offline `samples/search/google_cse_gm.json` |
| `fixtures` | — | Repo `fixtures/` with full post text |
| `stub` | — | Synthetic `example.invalid` URLs |

No unofficial Facebook scrapers. Reddit/forums are **explicit** providers (not selected by `auto`).

## Commands

```bash
cd services/collector
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

fhuk-collector providers
fhuk-collector keywords

# Offline smoke (no search API keys)
fhuk-collector run --provider recorded --limit-queries 10

# Reddit offline (recorded UK land / self-build style posts)
fhuk-collector run --provider reddit --limit-queries 8

# Light UK forums offline
fhuk-collector run --provider forums --limit-queries 6

# Write to Postgres then open /leads
fhuk-collector run --provider reddit --write

# Live Reddit when OAuth app credentials are set
fhuk-collector run --provider reddit --limit-queries 5 --write

# Live Google/Bing when keys are set
fhuk-collector run --provider google --limit-queries 5 --write
fhuk-collector run --provider bing --limit-queries 5 --write
```

## Reddit env

```bash
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...
REDDIT_USER_AGENT=fhuk-land-finder/0.1 (by your-reddit-username)
REDDIT_SUBREDDITS=SelfBuild,HousingUK,manchester,UKProperty,AskUK
# optional: try public .json before recorded fallback
REDDIT_ALLOW_PUBLIC_JSON=false
```

Create a Reddit “script” or “web” app at https://www.reddit.com/prefs/apps and use client credentials grant.

## Samples

- `samples/search/google_cse_gm.json` — recorded CSE-shaped payload
- `samples/search/bing_gm.json` — Bing-shaped reference sample
- `samples/search/reddit_gm.json` — recorded Reddit-style GM land posts
- `samples/search/uk_forums_gm.json` — light UK forum recorded threads
