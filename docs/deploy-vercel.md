# Deploy FHUK Land Finder dashboard (Vercel + Postgres)

Production target: **Next.js app in `apps/web`**, backed by **PostgreSQL**. Collectors stay offline/CI — they are not deployed to Vercel.

No secrets belong in git. Set connection strings and API keys only in the Vercel project (or your local `.env`).

## Fix: `[NEXT_NO_VERSION] No Next.js version detected`

This error means Vercel is building from the **repo root** (or another folder without `next` in `package.json`). The Next.js dependency lives only in `apps/web/package.json`.

**Required — Vercel Project Settings UI only** (`rootDirectory` is **not** a valid `vercel.json` key; setting it fails schema validation):

1. Open the project → **Settings → Build and Deployment → Root Directory**
2. Set Root Directory to **`apps/web`** (Edit → select `apps/web` → Save). This **must** be done in the UI.
3. Framework Preset: **Next.js**
4. Leave Install / Build as defaults once Root Directory is `apps/web`:
   - Install: `npm ci` (or `npm install`)
   - Build: `npm run build`
   - Output: leave as Next.js default (do not set a static export directory)
5. Redeploy (Deployments → … → Redeploy), or push a new commit

Repo helpers (not a substitute for the UI Root Directory setting):

| File | Purpose |
| ---- | ------- |
| `/apps/web/vercel.json` | Framework Next.js, `npm ci` / `npm run build`, region `lhr1` — used when Root Directory is `apps/web` |
| `/apps/web/package.json` | Declares `next` (required for version detection) |

Do **not** point Root Directory at `.` / repo root. Root `package.json` has no `next` dependency — that produces `NEXT_NO_VERSION`. Do not add `"rootDirectory"` to any `vercel.json`.

## Prerequisites

- GitHub repo access: `denowlaa-sketch/fhuk-land-finder`
- A [Vercel](https://vercel.com) account linked to that GitHub user/org
- A hosted Postgres database (any of Neon, Supabase, or Vercel Postgres)
- Node.js 20+ for local verification

## 1. Create Postgres and run migrations

Use a **pooled** connection string for the dashboard (Neon “pooled”, Supabase “Transaction” pooler, or Vercel Postgres `POSTGRES_PRISMA_URL` / pooled URL). Direct URLs are fine for one-off migrations.

### Neon

1. Create a project at [console.neon.tech](https://console.neon.tech) (region close to `lhr1` if possible).
2. Copy the **pooled** connection string (`…-pooler…` host).
3. From your laptop (with `psql`):

```bash
export DATABASE_URL='postgresql://USER:PASSWORD@HOST/DB?sslmode=require'
psql "$DATABASE_URL" -f db/migrations/001_leads.sql
psql "$DATABASE_URL" -f db/migrations/002_crm_parity.sql
```

### Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. **Project Settings → Database** → copy the URI (prefer the pooler / transaction mode URL for the app).
3. Append `?sslmode=require` if missing, then run `001_leads.sql` and `002_crm_parity.sql`.

### Vercel Postgres

1. In the Vercel project → **Storage** → create a Postgres store and attach it to the project.
2. Vercel injects `POSTGRES_URL` / related vars. Map the pooled URL to `DATABASE_URL` (see env table below), or set `DATABASE_URL` manually to that value.
3. Run the migration once with `psql` against the **direct** URL if the pooler rejects DDL:

```bash
psql "$POSTGRES_URL_NON_POOLING" -f db/migrations/001_leads.sql
psql "$POSTGRES_URL_NON_POOLING" -f db/migrations/002_crm_parity.sql
```

`001_leads.sql` / `002_crm_parity.sql` are **not fully idempotent** (enum `CREATE TYPE` will error on re-run). Run each once per empty database (001 then 002). To re-apply after a wipe, drop the database/schema first.

## 2. Import the project on Vercel

1. [vercel.com/new](https://vercel.com/new) → Import `denowlaa-sketch/fhuk-land-finder`.
2. **Root Directory**: set to `apps/web` in the Vercel UI (required — monorepo). Confirm again under **Settings → Build and Deployment** after import. Cannot be set via `vercel.json`.
3. Framework preset: **Next.js** (auto from `apps/web/vercel.json` / `apps/web/package.json`).
4. Build settings (defaults are correct when Root Directory is `apps/web`):
   - Install: `npm ci` (or `npm install`) — runs inside `apps/web`
   - Build: `npm run build` — runs `next build` from `apps/web`
   - Output: Next.js default (do not set a static export)
5. Deploy region preference is `lhr1` (London) via `apps/web/vercel.json`.

Do **not** point Root Directory at the repo root. The web app owns its lockfile and `next` dependency under `apps/web`. If you already imported with Root Directory `.`, change it to `apps/web` in Project Settings and redeploy (see troubleshooting at the top).

## 3. Environment variables

In Vercel → Project → **Settings → Environment Variables**, add:

| Name | Required | Environments | Notes |
| ---- | -------- | ------------ | ----- |
| `DATABASE_URL` | Recommended for live leads | Production (Preview optional) | Pooled Postgres URL with `sslmode=require`. Without it the UI falls back to fixture/demo mode (status updates / paste-save disabled). |
| `OPENAI_API_KEY` | Optional | Production / Preview | Improves Facebook paste analysis; without it heuristics still work. |
| `OPENAI_MODEL` | Optional | Production / Preview | Defaults to `gpt-4o-mini`. |
| `NEXT_PUBLIC_APP_NAME` | Optional | Any | Defaults via `.env.example`; branding only. |
| `PGSSL` | Optional | Any | Set `require` to force TLS if the URL host is non-standard. |
| `PG_POOL_MAX` | Optional | Any | Defaults to `1` on Vercel; raise only for long-lived Node hosts. |

Never commit real values. Locally: `cp .env.example .env` at the repo root (or `apps/web/.env.local`).

If you use Vercel Postgres storage integration, either:

- set `DATABASE_URL` = the pooled `POSTGRES_URL`, or  
- keep both and ensure the app reads `DATABASE_URL` (this codebase only reads `DATABASE_URL` — not `POSTGRES_URL` / `POSTGRES_PRISMA_URL`).

**Dashboard still says fixtures after setting env?** Common causes:

1. Variable named `POSTGRES_URL` only — copy/alias to `DATABASE_URL`.
2. Env scoped to Preview while you are on the Production URL (or the reverse).
3. Env added without a **Redeploy** (existing serverless isolates keep the old env).
4. `DATABASE_URL` is present but connect/query fails (SSL, auth, or migration not run) — the UI used to swallow that and print “fixtures”; it now shows an amber banner with the Postgres error. Check Vercel function logs for `[fetchLeads] DATABASE_URL set but Postgres query failed`.

`DATABASE_URL` is **server-only** (`process.env.DATABASE_URL` in `apps/web/src/lib/db.ts`). Do not use `NEXT_PUBLIC_DATABASE_URL`.

## 4. Deploy checklist

- [ ] Migrations applied once against empty DB (`001_leads.sql` then `002_crm_parity.sql`)
- [ ] Vercel Root Directory = `apps/web`
- [ ] `DATABASE_URL` set (pooled + SSL)
- [ ] Optional `OPENAI_API_KEY` for paste analysis
- [ ] Production deploy succeeds (`npm run build` green)
- [ ] Open `/leads` — should say **PostgreSQL** when DB is reachable
- [ ] Optional: run collector locally/CI with the same `DATABASE_URL` and `--write`, then refresh `/leads`
- [ ] Optional: `/paste` save path writes a lead when DB is configured

## 5. Local production verify

```bash
cd apps/web && npm ci && npm run build && npm start
```

From repo root: `npm run build` (proxies into `apps/web`).

## 6. Monorepo notes

| Path | Role on Vercel |
| ---- | -------------- |
| `apps/web` | Deployed Next.js dashboard (project root) |
| `db/migrations` | Run manually / CI against Postgres — not executed by Vercel |
| `services/collector` | Not deployed to Vercel |
| `fixtures/` | Traced into serverless bundles for demo fallback when `DATABASE_URL` is unset |

No Turborepo is required for this layout. Root `package.json` scripts (`dev` / `build` / `start`) already target `apps/web`.

## 7. Account / CLI deploy (optional)

If the GitHub integration is preferred, skip the CLI. To deploy from a machine with access:

```bash
cd apps/web
npx vercel login          # browser login as the FHUK owner (e.g. denola)
npx vercel link           # select team + project; confirm root apps/web
npx vercel env pull       # optional — pulls into .env.local (gitignored)
npx vercel --prod
```

If login fails with “No existing credentials found” / missing team, the owner must:

1. Create or join the Vercel team that should own the project.
2. Connect GitHub under **Account Settings → Login Connections**.
3. Import the repo (step 2) and set Root Directory + env vars.
4. Re-run `npx vercel login` on any CI machine that needs CLI deploys.

Agents without a user-linked Vercel token cannot finish production deploy; use the dashboard import flow above.
