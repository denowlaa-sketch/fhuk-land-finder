from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

from .connectors.base import SearchConnector
from .connectors.fixtures import load_all_fixture_hits
from .dedupe import is_duplicate
from .extract import extract_and_score
from .keywords import expand_queries, load_keywords
from .models import ExtractedLead, SearchHit

ResultStatus = Literal[
    "inserted",
    "dry_run",
    "duplicate_url",
    "duplicate_hash",
    "skipped_empty",
]


@dataclass
class PipelineResult:
    status: ResultStatus
    hit: SearchHit | None = None
    lead: ExtractedLead | None = None
    ref: str | None = None
    id: str | None = None
    detail: str | None = None

    def to_dict(self) -> dict[str, Any]:
        out: dict[str, Any] = {"status": self.status}
        if self.hit:
            out["url"] = self.hit.url
            out["query"] = self.hit.query
            out["source"] = self.hit.source
        if self.lead:
            out["lead"] = self.lead.to_dict()
        if self.ref:
            out["ref"] = self.ref
        if self.id:
            out["id"] = self.id
        if self.detail:
            out["detail"] = self.detail
        return out


@dataclass
class PipelineSummary:
    provider: str
    region: str
    query_count: int
    hit_count: int
    results: list[PipelineResult] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "region": self.region,
            "query_count": self.query_count,
            "hit_count": self.hit_count,
            "count": len(self.results),
            "inserted": sum(1 for r in self.results if r.status == "inserted"),
            "dry_run": sum(1 for r in self.results if r.status == "dry_run"),
            "duplicates": sum(
                1
                for r in self.results
                if r.status in {"duplicate_url", "duplicate_hash"}
            ),
            "results": [r.to_dict() for r in self.results],
        }


def collect_hits(
    connector: SearchConnector,
    *,
    queries: list[str],
    results_per_query: int = 5,
    use_all_fixtures: bool = False,
    fixtures_dir=None,
) -> list[SearchHit]:
    """Run search for each query and dedupe hits by URL."""
    if use_all_fixtures and fixtures_dir is not None:
        return load_all_fixture_hits(fixtures_dir)

    seen_urls: set[str] = set()
    hits: list[SearchHit] = []
    for query in queries:
        for hit in connector.search(query, num=results_per_query):
            if not hit.url or hit.url in seen_urls:
                continue
            seen_urls.add(hit.url)
            hits.append(hit)
    return hits


def run_pipeline(
    connector: SearchConnector,
    *,
    dry_run: bool = True,
    limit_queries: int | None = 20,
    results_per_query: int = 5,
    keywords_path=None,
    queries: list[str] | None = None,
    use_all_fixtures: bool = False,
    fixtures_dir=None,
    conn=None,
) -> PipelineSummary:
    """
    Greater Manchester path: keywords → search → extract/score → dedupe → store.

    Ownership confidence remains model/heuristic-driven; no invented contacts.
    """
    seed = load_keywords(keywords_path)
    resolved = list(queries) if queries is not None else expand_queries(seed)
    if limit_queries is not None:
        resolved = resolved[: max(0, limit_queries)]
    queries = resolved

    hits = collect_hits(
        connector,
        queries=queries or ["Greater Manchester land for sale"],
        results_per_query=results_per_query,
        use_all_fixtures=use_all_fixtures,
        fixtures_dir=fixtures_dir,
    )

    existing_hashes: set[str] = set()
    existing_urls: set[str] = set()
    if conn is not None and not dry_run:
        from . import db as dbmod

        existing_hashes = dbmod.fetch_existing_hashes(conn)
        existing_urls = dbmod.fetch_existing_urls(conn)

    results: list[PipelineResult] = []
    for hit in hits:
        if hit.url and hit.url in existing_urls:
            results.append(
                PipelineResult(status="duplicate_url", hit=hit, detail="url")
            )
            continue

        lead = extract_and_score(hit)
        if is_duplicate(existing_hashes, lead.content_hash):
            results.append(
                PipelineResult(
                    status="duplicate_hash",
                    hit=hit,
                    lead=lead,
                    detail=lead.content_hash,
                )
            )
            continue

        if dry_run or conn is None:
            results.append(PipelineResult(status="dry_run", hit=hit, lead=lead))
            existing_hashes.add(lead.content_hash)
            if lead.original_post_url:
                existing_urls.add(lead.original_post_url)
            continue

        from . import db as dbmod
        from . import notify as notifymod

        inserted = dbmod.insert_lead(conn, lead)
        existing_hashes.add(lead.content_hash)
        if lead.original_post_url:
            existing_urls.add(lead.original_post_url)
        notifymod.maybe_notify_lead(
            ref=inserted["ref"],
            location=lead.location,
            opportunity_type=lead.opportunity_type,
            ai_assessment=lead.ai_assessment,
            source=lead.source,
            original_post_url=lead.original_post_url,
            ai_rationale=lead.ai_rationale,
            created=True,
        )
        results.append(
            PipelineResult(
                status="inserted",
                hit=hit,
                lead=lead,
                id=inserted["id"],
                ref=inserted["ref"],
            )
        )

    return PipelineSummary(
        provider=getattr(connector, "name", "unknown"),
        region=str(seed.get("region", "Greater Manchester")),
        query_count=len(queries),
        hit_count=len(hits),
        results=results,
    )
