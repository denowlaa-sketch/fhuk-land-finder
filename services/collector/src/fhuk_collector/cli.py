from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

from .dedupe import is_duplicate
from .extract import extract_and_score, from_fixture_expected
from .keywords import expand_queries, load_keywords
from .search import load_fixture_hits, stub_search


def _repo_root() -> Path:
    # services/collector/src/fhuk_collector → repo root
    return Path(__file__).resolve().parents[4]


def _load_env() -> None:
    load_dotenv(_repo_root() / ".env")
    load_dotenv()


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


def cmd_run(args: argparse.Namespace) -> int:
    dry_run = (
        args.dry_run
        if args.dry_run is not None
        else os.getenv("COLLECTOR_DRY_RUN", "true").lower()
        in {"1", "true", "yes"}
    )

    if args.fixtures:
        fixtures_dir = Path(args.fixtures).resolve()
        hits = load_fixture_hits(fixtures_dir)
    else:
        queries = expand_queries()
        if args.limit_queries:
            queries = queries[: args.limit_queries]
        hits = stub_search(queries, limit_per_query=1)

    existing_hashes: set[str] = set()
    existing_urls: set[str] = set()
    conn = None
    if not dry_run:
        from . import db as dbmod

        conn = dbmod.connect()
        existing_hashes = dbmod.fetch_existing_hashes(conn)
        existing_urls = dbmod.fetch_existing_urls(conn)

    results = []
    for hit in hits:
        if hit.url and hit.url in existing_urls:
            results.append({"url": hit.url, "status": "duplicate_url"})
            continue
        lead = extract_and_score(hit)
        if is_duplicate(existing_hashes, lead.content_hash):
            results.append(
                {
                    "url": hit.url,
                    "status": "duplicate_hash",
                    "content_hash": lead.content_hash,
                }
            )
            continue
        if dry_run or conn is None:
            results.append({"status": "dry_run", "lead": lead.to_dict()})
        else:
            from . import db as dbmod

            inserted = dbmod.insert_lead(conn, lead)
            existing_hashes.add(lead.content_hash)
            if lead.original_post_url:
                existing_urls.add(lead.original_post_url)
            results.append({"status": "inserted", **inserted, "lead": lead.to_dict()})

    if conn is not None:
        conn.close()

    print(json.dumps({"count": len(results), "results": results}, indent=2, default=str))
    return 0


def cmd_seed_fixtures(args: argparse.Namespace) -> int:
    fixtures_dir = Path(args.fixtures).resolve()
    dry_run = (
        args.dry_run
        if args.dry_run is not None
        else os.getenv("COLLECTOR_DRY_RUN", "true").lower()
        in {"1", "true", "yes"}
    )

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

            inserted = dbmod.insert_lead(conn, lead)
            existing_hashes.add(lead.content_hash)
            if lead.original_post_url:
                existing_urls.add(lead.original_post_url)
            results.append({"file": path.name, "status": "inserted", **inserted})

    if conn is not None:
        conn.close()

    print(json.dumps({"count": len(results), "results": results}, indent=2, default=str))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="fhuk-collector",
        description="FHUK Land Finder collector (Phase 0)",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_kw = sub.add_parser("keywords", help="Expand phrase × town queries")
    p_kw.set_defaults(func=cmd_keywords)

    p_run = sub.add_parser("run", help="Stub search → extract → score")
    p_run.add_argument(
        "--fixtures",
        help="Use fixture posts as search hits instead of stub search",
    )
    p_run.add_argument("--limit-queries", type=int, default=20)
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
        help="Write leads to Postgres (requires DATABASE_URL)",
    )
    p_run.set_defaults(func=cmd_run)

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
