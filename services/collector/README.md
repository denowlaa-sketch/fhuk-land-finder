# FHUK collector

Python worker: Greater Manchester keywords → pluggable public web search → OpenAI extract/score → URL/content-hash dedupe → Postgres.

## Providers

| Provider | Needs | Notes |
| -------- | ----- | ----- |
| `auto` | — | google → bing → recorded |
| `google` | `GOOGLE_CSE_API_KEY`, `GOOGLE_CSE_CX` | Custom Search JSON API |
| `bing` | `BING_SEARCH_API_KEY` | Bing Web Search v7 |
| `recorded` | — | Offline `samples/search/google_cse_gm.json` |
| `fixtures` | — | Repo `fixtures/` with full post text |
| `stub` | — | Synthetic `example.invalid` URLs |

No unofficial Facebook scrapers.

## Commands

```bash
cd services/collector
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

fhuk-collector providers
fhuk-collector keywords

# Offline smoke (no search API keys)
fhuk-collector run --provider recorded --limit-queries 10

# Write to Postgres then open /leads
fhuk-collector run --provider recorded --write

# Live search when keys are set
fhuk-collector run --provider google --limit-queries 5 --write
fhuk-collector run --provider bing --limit-queries 5 --write
```

## Samples

- `samples/search/google_cse_gm.json` — recorded CSE-shaped payload (includes `raw_text` for extract)
- `samples/search/bing_gm.json` — Bing-shaped reference sample
