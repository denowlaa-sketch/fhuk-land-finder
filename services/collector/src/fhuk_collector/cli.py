from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

from .connectors import available_providers, resolve_connector
from .dedupe import is_duplicate
from .extract import from_fixture_expected
from .keywords import (
    expand_auctions_queries,
    expand_classifieds_queries,
    expand_queries,
    expand_reddit_queries,
    load_keywords,
)
from .pipeline import run_pipeline


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[4]


def _load_env() -> None:
    load_dotenv(_repo_root() / ".env")
    load_dotenv()


def _resolve_dry_run(args: argparse.Namespace) -> bool:
    if args.dry_run is not None:
        return bool(args.dry_run)
    return os.getenv("COLLECTOR_DRY_RUN", "true").lower() in {"1", "true", "yes"}


def cmd_keywords(_: argparse.Namespace) -> int:
    queries = expand_queries()
    seed = load_keywords()
    print(
        json.dumps(
            {
                "region": seed.get("region"),
                "town_count": len(seed.get("towns", [])),
                "phrase_count": len(seed.get("phrases", [])),
                "query_count": len(queries),
                "sample": queries[:10],
            },
            indent=2,
        )
    )
    return 0


def cmd_providers(_: argparse.Namespace) -> int:
    google_ready = bool(
        (os.getenv("GOOGLE_CSE_API_KEY") or "").strip()
        and (os.getenv("GOOGLE_CSE_CX") or "").strip()
    )
    reddit_ready = bool(
        (os.getenv("REDDIT_CLIENT_ID") or "").strip()
        and (os.getenv("REDDIT_CLIENT_SECRET") or "").strip()
    )
    print(
        json.dumps(
            {
                "providers": available_providers(),
                "live_readiness": {
                    "google_cse": google_ready,
                    "reddit_oauth": reddit_ready,
                    "bing": bool((os.getenv("BING_SEARCH_API_KEY") or "").strip()),
                    "classifieds_live_flag": os.getenv("CLASSIFIEDS_LIVE", "false"),
                    "auctions_live_flag": os.getenv("AUCTIONS_LIVE", "false"),
                },
                "note": (
                    "CSE/Reddit keys belong on the collector host (.env / CI), "
                    "not on Vercel. Missing Reddit keys → recorded sample."
                ),
            },
            indent=2,
        )
    )
    return 0


def cmd_run(args: argparse.Namespace) -> int:
    dry_run = _resolve_dry_run(args)
    fixtures_dir = (
        Path(args.fixtures).resolve()
        if args.fixtures
        else _repo_root() / "fixtures"
    )

    provider = args.provider
    use_all_fixtures = False
    if args.fixtures and not provider:
        provider = "fixtures"
        use_all_fixtures = True
    if provider == "fixtures":
        use_all_fixtures = True

    connector = resolve_connector(
        provider,
        fixtures_dir=fixtures_dir,
        recorded_path=Path(args.recorded).resolve() if args.recorded else None,
    )

    # Source-specific phrase sets aligned with the keyword library (+ extras).
    resolved_provider = getattr(connector, "name", provider or "")
    custom_queries = None
    if resolved_provider in {"reddit", "forums"}:
        custom_queries = expand_reddit_queries()
    elif resolved_provider in {"classifieds", "gumtree", "preloved", "freeads"}:
        custom_queries = expand_classifieds_queries()
    elif resolved_provider in {
        "auctions",
        "auctionhouse",
        "sdl",
        "eg",
        "plotfinder",
        "plotbrowser",
    }:
        custom_queries = expand_auctions_queries()

    conn = None
    if not dry_run:
        from . import db as dbmod

        conn = dbmod.connect()

    try:
        summary = run_pipeline(
            connector,
            dry_run=dry_run,
            limit_queries=args.limit_queries,
            results_per_query=args.results_per_query,
            queries=custom_queries,
            use_all_fixtures=use_all_fixtures,
            fixtures_dir=fixtures_dir if use_all_fixtures else None,
            conn=conn,
            as_leads=bool(getattr(args, "as_leads", False)),
        )
    finally:
        if conn is not None:
            conn.close()

    print(json.dumps(summary.to_dict(), indent=2, default=str))
    return 0


def cmd_analyze_paste(args: argparse.Namespace) -> int:
    from .facebook_paste import analyze_paste

    dry_run = _resolve_dry_run(args)

    if args.fixture:
        path = Path(args.fixture).resolve()
        data = json.loads(path.read_text(encoding="utf-8"))
        lead = analyze_paste(
            text=data["raw_text"],
            url=data.get("original_post_url"),
            title=data.get("title"),
        )
        payload: dict = {
            "fixture": path.name,
            "lead": lead.to_dict(),
            "note": "URL is metadata only — never fetched.",
        }
    else:
        if not args.text:
            print(
                json.dumps(
                    {
                        "error": "Provide --text or --fixture. "
                        "Facebook URLs are not fetched or scraped."
                    }
                ),
                file=sys.stderr,
            )
            return 2
        lead = analyze_paste(text=args.text, url=args.url)
        payload = {
            "lead": lead.to_dict(),
            "note": "URL is metadata only — never fetched.",
        }

    if dry_run:
        payload["status"] = "dry_run"
        print(json.dumps(payload, indent=2, default=str))
        return 0

    from . import db as dbmod
    from . import notify as notifymod

    conn = dbmod.connect()
    try:
        saved = dbmod.upsert_lead_by_url(conn, lead)
        payload["status"] = "inserted" if saved.get("created") else "updated"
        payload.update(saved)
        notify_result = notifymod.maybe_notify_lead(
            ref=saved["ref"],
            location=lead.location,
            opportunity_type=lead.opportunity_type,
            ai_assessment=lead.ai_assessment,
            source=lead.source,
            original_post_url=lead.original_post_url,
            ai_rationale=lead.ai_rationale,
            created=bool(saved.get("created")),
        )
        if notify_result is not None:
            payload["notify"] = notify_result
    finally:
        conn.close()
    print(json.dumps(payload, indent=2, default=str))
    return 0


def cmd_seed_fixtures(args: argparse.Namespace) -> int:
    fixtures_dir = Path(args.fixtures).resolve()
    dry_run = _resolve_dry_run(args)

    conn = None
    existing_hashes: set[str] = set()
    existing_urls: set[str] = set()
    if not dry_run:
        from . import db as dbmod

        conn = dbmod.connect()
        existing_hashes = dbmod.fetch_existing_hashes(conn)
        existing_urls = dbmod.fetch_existing_urls(conn)

    results = []
    for path in sorted(fixtures_dir.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        lead = from_fixture_expected(data)
        if lead.original_post_url and lead.original_post_url in existing_urls:
            results.append({"file": path.name, "status": "duplicate_url"})
            continue
        if is_duplicate(existing_hashes, lead.content_hash):
            results.append({"file": path.name, "status": "duplicate_hash"})
            continue
        if dry_run or conn is None:
            results.append(
                {"file": path.name, "status": "dry_run", "lead": lead.to_dict()}
            )
        else:
            from . import db as dbmod
            from . import notify as notifymod

            inserted = dbmod.insert_lead(conn, lead)
            existing_hashes.add(lead.content_hash)
            if lead.original_post_url:
                existing_urls.add(lead.original_post_url)
            notify_result = notifymod.maybe_notify_lead(
                ref=inserted["ref"],
                location=lead.location,
                opportunity_type=lead.opportunity_type,
                ai_assessment=lead.ai_assessment,
                source=lead.source,
                original_post_url=lead.original_post_url,
                ai_rationale=lead.ai_rationale,
                created=True,
            )
            entry = {"file": path.name, "status": "inserted", **inserted}
            if notify_result is not None:
                entry["notify"] = notify_result
            results.append(entry)

    if conn is not None:
        conn.close()

    print(json.dumps({"count": len(results), "results": results}, indent=2, default=str))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="fhuk-collector",
        description="FHUK Land Finder collector — GM search → extract → store",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_kw = sub.add_parser("keywords", help="Expand phrase × town queries")
    p_kw.set_defaults(func=cmd_keywords)

    p_prov = sub.add_parser("providers", help="List search providers")
    p_prov.set_defaults(func=cmd_providers)

    p_run = sub.add_parser(
        "run",
        help="Keywords → search → extract/score → dedupe → (optional) Postgres",
    )
    p_run.add_argument(
        "--provider",
        choices=sorted(available_providers().keys()),
        default=None,
        help="Search connector (default: SEARCH_PROVIDER or auto)",
    )
    p_run.add_argument(
        "--fixtures",
        help="Fixtures directory; implies --provider fixtures when provider omitted",
    )
    p_run.add_argument(
        "--recorded",
        help="Path to recorded Google CSE / sample JSON",
    )
    p_run.add_argument(
        "--limit-queries",
        type=int,
        default=20,
        help="Max keyword queries (default 20). Use 0 for none (fixtures-all still works).",
    )
    p_run.add_argument(
        "--results-per-query",
        type=int,
        default=5,
        help="Hits to request per query (default 5)",
    )
    p_run.add_argument(
        "--dry-run",
        dest="dry_run",
        action="store_true",
        default=None,
        help="Print results without writing to Postgres",
    )
    p_run.add_argument(
        "--write",
        dest="dry_run",
        action="store_false",
        help="Write discovery_prospects to Postgres (requires DATABASE_URL + migration 002)",
    )
    p_run.add_argument(
        "--as-leads",
        action="store_true",
        default=False,
        help="With --write, insert CRM leads directly instead of the discovery inbox",
    )
    p_run.set_defaults(func=cmd_run)

    p_paste = sub.add_parser(
        "analyze-paste",
        help="Analyse a pasted Facebook URL + post text (no scrape/fetch)",
    )
    p_paste.add_argument("--url", default=None, help="Public Facebook post URL (not fetched)")
    p_paste.add_argument("--text", default=None, help="Pasted post body")
    p_paste.add_argument(
        "--fixture",
        default=None,
        help="Path to a fixtures/facebook/*.json file",
    )
    p_paste.add_argument(
        "--dry-run",
        dest="dry_run",
        action="store_true",
        default=None,
    )
    p_paste.add_argument(
        "--write",
        dest="dry_run",
        action="store_false",
        help="Upsert lead into Postgres",
    )
    p_paste.set_defaults(func=cmd_analyze_paste)

    p_seed = sub.add_parser(
        "seed-fixtures",
        help="Insert fixture expected values into Postgres",
    )
    p_seed.add_argument(
        "--fixtures",
        default=str(_repo_root() / "fixtures"),
        help="Directory of fixture JSON files",
    )
    p_seed.add_argument(
        "--dry-run",
        dest="dry_run",
        action="store_true",
        default=None,
    )
    p_seed.add_argument(
        "--write",
        dest="dry_run",
        action="store_false",
    )
    p_seed.set_defaults(func=cmd_seed_fixtures)

    return parser


def main(argv: list[str] | None = None) -> None:
    _load_env()
    parser = build_parser()
    args = parser.parse_args(argv)
    code = args.func(args)
    sys.exit(code)


if __name__ == "__main__":
    main()
