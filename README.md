# FHUK Land Finder

Off-market UK land sourcing for **Flipping Homes UK**. Discovery and AI qualification only — no unofficial Facebook scrapers, no paid mapping/planning APIs, no automated outreach.

## Stack

| Layer | Choice |
| ----- | ------ |
| Dashboard | Next.js App Router (TypeScript) — `apps/web` |
| Collectors | Python — `services/collector` |
| Database | PostgreSQL — `db/migrations` |
| Extraction / scoring | OpenAI API |
| Search | Pluggable: Google CSE / Bing / recorded sample / fixtures |

## Layout

```
apps/web/                      Next.js leads list, detail, contact-status pipeline
services/collector/            Keyword seed, search connectors, extract/score, dedupe
services/collector/samples/    Recorded Google CSE / Bing-shaped JSON for offline runs
db/migrations/                 SQL schema for leads (FHUK-NNNN refs)
data/keywords/                 Greater Manchester phrase × town seed
fixtures/                      Five hypothetical example posts
.env.example                   Required environment variables
```

## Lead fields

`FHUK-NNNN` ref, location, opportunity type, land size, asking price, planning status, source, original post URL, landowner name, contact, ownership confidence, seller motivation, AI assessment (`Strong` / `Investigate` / `Reject`), date discovered, contact status pipeline (`Not contacted` → … → `Rejected`).

Ownership confidence stays honest: confirmed / likely / possible / unknown — never invented from thin snippets.

## Prerequisites

- Node.js 20+
- Python 3.11+
- PostgreSQL 14+ (optional for fixture-only dashboard; required to persist collector output)

## Setup

```bash
cp .env.example .env
# set DATABASE_URL; optionally OPENAI_API_KEY and search API keys
```

### Database

```bash
createdb fhuk_land_finder
psql "$DATABASE_URL" -f db/migrations/001_leads.sql
```

### Web dashboard

```bash
cd apps/web && npm install && npm run dev
```

Open [http://localhost:3000/leads](http://localhost:3000/leads).

| `DATABASE_URL` | Dashboard source |
| -------------- | ---------------- |
| unset / unreachable | Fixture leads (read-only status) |
| set + migrated | Live Postgres rows (refresh after collector `--write`) |

### Collector

```bash
cd services/collector
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
fhuk-collector providers
fhuk-collector keywords
```

## One-command smoke (offline — no search API keys)

Recorded Google CSE-shaped sample → extract/score → (optional) Postgres → dashboard.

```bash
# Terminal A — dashboard
cd apps/web && npm run dev

# Terminal B — collector (dry-run without DB)
cd services/collector && source .venv/bin/activate
fhuk-collector run --provider recorded --limit-queries 10

# Persist when Postgres is ready
fhuk-collector run --provider recorded --limit-queries 10 --write
# then refresh http://localhost:3000/leads
```

Equivalent with fixtures (full post text, skips keyword search loop):

```bash
fhuk-collector run --fixtures ../../fixtures --write
```

## What works without API keys vs with keys

| Capability | No keys | With keys |
| ---------- | ------- | --------- |
| Keyword expand (GM) | Yes | Yes |
| Search | `recorded` / `fixtures` / `stub` | `google` (CSE) or `bing` |
| Extract / score | Heuristic fallback | OpenAI (`OPENAI_API_KEY`) |
| Dedupe + dry-run JSON | Yes | Yes |
| Insert Postgres | Needs `DATABASE_URL` only | Same |
| Dashboard list | Fixtures fallback | DB when `DATABASE_URL` set |

`SEARCH_PROVIDER=auto` (default): Google if `GOOGLE_CSE_API_KEY` + `GOOGLE_CSE_CX`, else Bing if `BING_SEARCH_API_KEY`, else **recorded**.

Live Google/Bing hits use the result **snippet** as extract input (no page scrape in this phase). Treat ownership as provisional.

## Tests

```bash
cd services/collector && pytest
```

## Scope notes

- In scope: GM keyword → pluggable public search → AI extract/score → dedupe → Postgres → dashboard refresh
- Out of scope: unofficial Facebook scraping, paid mapping/planning APIs, automated outreach, auctions
