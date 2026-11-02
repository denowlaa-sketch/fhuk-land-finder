# FHUK Land Finder

Off-market UK land sourcing for **Flipping Homes UK**. Phase 0 covers discovery and AI qualification only — no unofficial Facebook scrapers, no paid mapping/planning APIs, no automated outreach.

## Stack

| Layer | Choice |
| ----- | ------ |
| Dashboard | Next.js App Router (TypeScript) — `apps/web` |
| Collectors | Python — `services/collector` |
| Database | PostgreSQL — `db/migrations` |
| Extraction / scoring | OpenAI API |

## Layout

```
apps/web/                 Next.js leads list, detail, contact-status pipeline
services/collector/       Keyword seed, stub search, OpenAI extract/score, dedupe
db/migrations/            SQL schema for leads (FHUK-NNNN refs)
data/keywords/            Greater Manchester phrase × town seed
fixtures/                 Five hypothetical example posts
.env.example              Required environment variables
```

## Lead fields

`FHUK-NNNN` ref, location, opportunity type, land size, asking price, planning status, source, original post URL, landowner name, contact, ownership confidence, seller motivation, AI assessment (`Strong` / `Investigate` / `Reject`), date discovered, contact status pipeline (`Not contacted` → `Contacted` → `Interested` → `Negotiating` → `Under offer` → `Rejected`).

## Prerequisites

- Node.js 20+
- Python 3.11+
- PostgreSQL 14+ (optional for fixture-only dashboard demo)

## Setup

```bash
cp .env.example .env
# set DATABASE_URL and OPENAI_API_KEY when ready
```

### Database

```bash
createdb fhuk_land_finder   # or use your own URL
psql "$DATABASE_URL" -f db/migrations/001_leads.sql
```

### Web dashboard

```bash
cd apps/web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → redirects to `/leads`.

Without `DATABASE_URL`, the app serves the five fixture leads (read-only status).

### Collector

```bash
cd services/collector
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# Phrase × Greater Manchester town queries
fhuk-collector keywords

# Dry-run extract/score on fixtures (uses OpenAI if OPENAI_API_KEY set; else heuristics)
fhuk-collector run --fixtures ../../../fixtures

# Insert fixture expected values into Postgres
COLLECTOR_DRY_RUN=false fhuk-collector seed-fixtures --fixtures ../../../fixtures --write

# Stub search over keyword queries (no external HTTP)
fhuk-collector run --limit-queries 20
```

### Tests

```bash
cd services/collector
pytest
```

## Phase 0 scope

- Greenfield monorepo scaffold
- Lead schema + keyword seed for Greater Manchester
- Stub search (placeholder for Phase 1 public web connectors)
- OpenAI extract/score with offline heuristic fallback
- URL / content-hash dedupe
- Dashboard: leads list, detail, status updates

Out of scope until later phases: real search connectors, Facebook-safe indexed discovery, auctions, CSV/PDF export, maps.
