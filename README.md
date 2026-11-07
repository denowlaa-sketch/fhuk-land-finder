# FHUK Land Finder

Off-market UK land sourcing for **Flipping Homes UK**. Discovery and AI qualification — no unofficial Facebook scrapers, no paid mapping/planning APIs. Optional **PECR-safe** Facebook Instant Form → consent-gated call qualify (sandbox by default; live Twilio opt-in).

## Stack

| Layer | Choice |
| ----- | ------ |
| Dashboard | Next.js App Router + Tailwind — `apps/web` (Vercel Root Directory) |
| Collectors | Python — `services/collector` → Discovery inbox |
| Database | PostgreSQL — `db/migrations` |
| Extraction / scoring | OpenAI extract + deterministic land rule scorer (reasons / unknowns) |
| Search | Pluggable: Google CSE / Bing / Reddit / forums / classifieds / auctions / recorded / fixtures |

## Layout

```
apps/web/                      Sidebar CRM: Dashboard, Leads, Discovery, Settings (+ Companies/Contacts stubs)
services/collector/            Keyword seed, search connectors, extract/score → discovery_prospects
services/collector/samples/    Recorded Google CSE / Bing / Reddit / forums / classifieds / auctions JSON for offline runs
db/migrations/                 SQL schema (leads, analyses, discovery, call_attempts)
data/keywords/                 Greater Manchester phrase × town seed
fixtures/                      Five hypothetical example posts (+ facebook paste fixtures)
.env.example                   Required environment variables
```

## Lead / CRM fields

`FHUK-NNNN` ref, location, opportunity type, land size, asking price, planning status, source / source kind, original post URL, landowner name, contact, ownership confidence, seller motivation, AI assessment (`Strong` / `Investigate` / `Reject` mapped onto qualification), numeric **score** 0–100, **category** A–D, **qualification** label, **reasons** / **unknowns** JSON, analysis history, pipeline status `NEW → CONTACTED → QUALIFIED → PROPOSAL → NEGOTIATION → WON | LOST`.

Ownership confidence stays honest: confirmed / likely / possible / unknown — never invent contact/price facts (show **Unknown**).

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
psql "$DATABASE_URL" -f db/migrations/002_crm_parity.sql
psql "$DATABASE_URL" -f db/migrations/003_facebook_calls.sql
```

### Web dashboard

```bash
cd apps/web && npm install && npm run dev
```

Open [http://localhost:3000/](http://localhost:3000/) (Dashboard). Also: `/facebook`, `/leads`, `/discovery`, `/settings`, `/paste`.

| `DATABASE_URL` | Dashboard source |
| -------------- | ---------------- |
| unset / unreachable | Fixture leads (read-only status); Discovery shows fixture/sample inbox |
| set + migrated | Live Postgres rows; collector `--write` fills Discovery → Import creates leads |

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

# Persist when Postgres is ready (fills Discovery inbox after migration 002)
fhuk-collector run --provider recorded --limit-queries 10 --write
# then open http://localhost:3000/discovery → Import
# Legacy: write straight into CRM leads
fhuk-collector run --provider recorded --limit-queries 10 --write --as-leads
```

Equivalent with fixtures (full post text, skips keyword search loop):

```bash
fhuk-collector run --fixtures ../../fixtures --write
```

### Reddit / UK forums smoke

```bash
# Offline — no Reddit API keys (uses samples/search/reddit_gm.json)
fhuk-collector run --provider reddit --limit-queries 8

# Light UK property/self-build forum recorded threads
fhuk-collector run --provider forums --limit-queries 6

# Live Reddit (official OAuth client credentials)
# set REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USER_AGENT
fhuk-collector run --provider reddit --limit-queries 5 --write
```

### Classifieds smoke (Gumtree / Preloved / Freeads)

```bash
# Offline recorded private landowner-style ads (default — no scrape)
fhuk-collector run --provider classifieds --limit-queries 8

# Per-site
fhuk-collector run --provider gumtree --limit-queries 5

# Optional live: Google CSE site: filters only (set CLASSIFIEDS_LIVE=true + CSE keys)
# No HTML scraping of classified sites (ToS / brittleness).
```

### Auctions / specialist land smoke

```bash
# Offline recorded GM/UK land auction lots + Plotfinder/PlotBrowser (default — no scrape)
fhuk-collector run --provider auctions --limit-queries 8

# Per-site catalogues / specialist plot sites
fhuk-collector run --provider auctionhouse --limit-queries 5
fhuk-collector run --provider plotfinder --limit-queries 5

# Optional live: Google CSE site: filters only (set AUCTIONS_LIVE=true + CSE keys)
# No HTML scraping of auction/plot catalogue pages (ToS / brittleness).
```

### Facebook paste (compliant — no scrape)

Dashboard: open [http://localhost:3000/paste](http://localhost:3000/paste), paste a public Facebook URL (optional) **and** the post text you copied → Analyse (or Analyse & save lead).

CLI helper:

```bash
fhuk-collector analyze-paste \
  --fixture ../../fixtures/facebook/01-fb-bolton-garden.json

fhuk-collector analyze-paste \
  --url 'https://www.facebook.com/groups/example.invalid/posts/1' \
  --text 'We own a house in Bolton and may sell the rear garden…'
```

The URL is stored as metadata only — **never fetched**. No Graph API, no group scrapers. Ownership/sale intent are not assumed from the link alone. Contacts only if voluntarily present in the pasted text. Labels: Strong / Investigate / Reject.

### Facebook Instant Form → call qualify (PECR)

Meta Lead Ads Instant Form webhook (or local simulate) → score → **call queue only when `consent_to_call` is true** and a phone is present. Sandbox script first; live Twilio behind `TWILIO_LIVE_DIALS=true`. Owner email only on call **QUALIFIED**. Seller is never emailed from this flow. `NO_ANSWER` / `CALLBACK` leave the lead `CONTACTED` so it reappears in the queue (ops recall — no spam redialer).

```
Meta Instant Form (or /facebook simulate)
  → GET/POST /api/facebook/leadgen  |  POST /api/facebook/leads/simulate
  → ingest (status NEW, source_kind FACEBOOK, consent_to_call + consent_at)
  → form score only — no dial, no email

Consented + phone + NEW|CONTACTED
  → Call queue (/facebook)
  → POST /api/calls/:id/start   (sandbox)  OR  POST /api/calls/:id/dial  (live)
  → complete → QUALIFIED (owner email) | UNQUALIFIED (LOST) | NO_ANSWER|CALLBACK (stay CONTACTED)
```

| Variable | Purpose |
| -------- | ------- |
| `FACEBOOK_VERIFY_TOKEN` | Webhook `hub.verify_token` |
| `FACEBOOK_PAGE_ACCESS_TOKEN` | Graph lead fetch |
| `FACEBOOK_APP_SECRET` | Optional `X-Hub-Signature-256` |
| `FACEBOOK_ALLOW_SIMULATE` | Prod gate for simulate API |
| `TWILIO_ACCOUNT_SID` / `AUTH_TOKEN` / `PHONE_NUMBER` | Live dials |
| `TWILIO_PUBLIC_BASE_URL` | Public HTTPS base for TwiML callbacks |
| `TWILIO_LIVE_DIALS` | Must be `true` to allow live dial (default off) |
| `OWNER_NOTIFY_EMAIL` | QUALIFIED owner alert (else `NOTIFY_EMAIL_TO`) |

Apply migration `003_facebook_calls.sql`. UI: `/facebook`, `/facebook/calls/[id]`. Discovery/scraped numbers are **not** dialled.

## Email lead notifications

When a **new** lead with AI assessment `Strong` or `Investigate` is written
(collector `run --write`, `analyze-paste --write`, or dashboard paste save),
an optional summary email can be sent (ref, location, type, assessment, source link).

| Variable | Purpose |
| -------- | ------- |
| `NOTIFY_EMAIL_ENABLED` | Master switch (`true` / `false`) |
| `NOTIFY_EMAIL_MODE` | `dry-run` (default — log only) or `send` |
| `NOTIFY_EMAIL_TO` | Recipient(s), comma-separated |
| `NOTIFY_EMAIL_FROM` | From address |
| `NOTIFY_EMAIL_PROVIDER` | `smtp` \| `resend` \| `sendgrid` |
| `SMTP_*` / `RESEND_API_KEY` / `SENDGRID_API_KEY` | Provider credentials |

Offline / CI-friendly: leave `NOTIFY_EMAIL_MODE=dry-run` — the collector prints a JSON `notify` dry-run line instead of sending.

Dashboard: **Settings** (`/settings`) shows live status and a paste-path toggle (browser preference; collector still follows env).

```bash
# Dry-run notify smoke (no inbox)
NOTIFY_EMAIL_ENABLED=true \
NOTIFY_EMAIL_TO=you@example.com \
NOTIFY_EMAIL_MODE=dry-run \
fhuk-collector run --provider recorded --limit-queries 5 --write
```

## What works without API keys vs with keys

| Capability | No keys | With keys |
| ---------- | ------- | --------- |
| Keyword expand (GM) | Yes | Yes |
| Search | `recorded` / `fixtures` / `stub` / `reddit` (recorded) / `forums` / `classifieds` / `auctions` | `google`, `bing`, `reddit` (OAuth), `classifieds`/`auctions` live via CSE `site:` |
| Facebook paste | Heuristic analyse + preview; save needs DB | OpenAI extract when `OPENAI_API_KEY` set |
| Extract / score | Heuristic fallback | OpenAI (`OPENAI_API_KEY`) |
| Dedupe + dry-run JSON | Yes | Yes |
| Insert Postgres | Needs `DATABASE_URL` only | Same |
| Dashboard list | Fixtures fallback | DB when `DATABASE_URL` set |
| Email notify | Dry-run log mode | SMTP / Resend / SendGrid (`NOTIFY_EMAIL_MODE=send`) |

`SEARCH_PROVIDER=auto` (default): Google if `GOOGLE_CSE_API_KEY` + `GOOGLE_CSE_CX`, else Bing if `BING_SEARCH_API_KEY`, else **recorded**. Reddit/forums/classifieds/auctions are explicit (`--provider reddit|forums|classifieds|gumtree|preloved|freeads|auctions|auctionhouse|sdl|eg|plotfinder|plotbrowser`).

Live Google/Bing/CSE hits use the result **snippet** as extract input (no page scrape in this phase). Treat ownership as provisional.

## Deploy (Vercel + Postgres)

Production dashboard is **`apps/web`** on Vercel. Full checklist (Root Directory, env vars, Neon/Supabase/Vercel Postgres, migrations): **[docs/deploy-vercel.md](docs/deploy-vercel.md)**.

Quick path:

1. Create hosted Postgres → run `001_leads.sql`, `002_crm_parity.sql`, then `003_facebook_calls.sql` once.
2. Import this repo on Vercel → **Settings → Build and Deployment → Root Directory = `apps/web`** (UI only — `rootDirectory` is not valid in `vercel.json`).
3. Framework **Next.js**; Install `npm ci` / Build `npm run build` (defaults once Root Directory is correct; also set in `apps/web/vercel.json`).
4. Set env vars (no secrets in git): `DATABASE_URL` (pooled + `sslmode=require`), optional `OPENAI_API_KEY`, optional Facebook/Twilio/email vars.
5. Deploy; open `/leads` and confirm source is PostgreSQL.

If deploy fails with `[NEXT_NO_VERSION] No Next.js version detected`, Root Directory is still the repo root — set it to `apps/web` in the Vercel UI and redeploy. See **[docs/deploy-vercel.md](docs/deploy-vercel.md)**.

Local production build: `cd apps/web && npm ci && npm run build`.

## Tests

```bash
cd services/collector && pytest
```

## Scope notes

- In scope: GM keyword → pluggable public search (incl. classifieds, UK auction catalogues / specialist plot sites) → AI extract/score → dedupe → Postgres → dashboard refresh; Facebook **paste** analysis (no fetch); Facebook Instant Form webhook + PECR consent-gated sandbox/live call qualify + owner QUALIFIED email; optional Strong/Investigate email alerts; Vercel + Postgres deploy path
- Out of scope: unofficial Facebook scraping / Graph mass search, paid mapping/planning APIs, cold dial of discovery/scraped numbers, brittle HTML scrapes of auction/plot sites
