# FHUK collector (Phase 0)

Python worker for keyword-seeded discovery, stub search, OpenAI extract/score, and URL/content-hash dedupe.

## Commands

```bash
cd services/collector
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# Expand Greater Manchester keyword × town queries
fhuk-collector keywords

# Run stub search → extract → score (dry-run by default)
fhuk-collector run --fixtures ../../../fixtures

# Load fixture expected values into Postgres (no OpenAI call)
fhuk-collector seed-fixtures --fixtures ../../../fixtures
```

Set `DATABASE_URL` and `OPENAI_API_KEY` in the repo-root `.env` (see `.env.example`).
With `COLLECTOR_DRY_RUN=true` (default), results print to stdout and are not written to the DB.
