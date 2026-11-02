from __future__ import annotations

import json
from pathlib import Path

from .models import SearchHit


def stub_search(queries: list[str], limit_per_query: int = 1) -> list[SearchHit]:
    """
    Phase 0 stub search.

    Returns synthetic hits derived from the query text only.
    No external HTTP, no unofficial Facebook scrapers, no paid APIs.
    Real connectors (Google/Bing/public classifieds) arrive in Phase 1.
    """
    hits: list[SearchHit] = []
    for i, query in enumerate(queries[:50]):  # cap for Phase 0 demos
        for n in range(limit_per_query):
            slug = query.lower().replace(" ", "-")[:60]
            url = f"https://example.invalid/stub/{i}-{n}/{slug}"
            hits.append(
                SearchHit(
                    title=f"Stub result for: {query}",
                    url=url,
                    snippet=(
                        f"Hypothetical public web mention matching “{query}”. "
                        "Replace with a real search connector in Phase 1."
                    ),
                    source="stub_search",
                    query=query,
                    raw_text=None,
                )
            )
    return hits


def load_fixture_hits(fixtures_dir: Path) -> list[SearchHit]:
    """Treat fixture JSON files as search hits with full raw text."""
    hits: list[SearchHit] = []
    for path in sorted(fixtures_dir.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        hits.append(
            SearchHit(
                title=data.get("title", path.stem),
                url=data["original_post_url"],
                snippet=data["raw_text"][:240],
                source=data.get("source", "fixture"),
                query=data.get("town", ""),
                raw_text=data["raw_text"],
            )
        )
    return hits
