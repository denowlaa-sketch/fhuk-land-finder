from __future__ import annotations

import json
from pathlib import Path

from fhuk_collector.models import SearchHit


class FixtureSearchConnector:
    """Treat repo fixture posts as search hits (offline E2E with full text)."""

    name = "fixtures"

    def __init__(self, fixtures_dir: Path) -> None:
        self.fixtures_dir = fixtures_dir

    def search(self, query: str, *, num: int = 5) -> list[SearchHit]:
        q = query.lower()
        hits: list[SearchHit] = []
        for path in sorted(self.fixtures_dir.glob("*.json")):
            data = json.loads(path.read_text(encoding="utf-8"))
            town = str(data.get("town", "")).lower()
            title = str(data.get("title", path.stem)).lower()
            # Match when the town appears in the keyword query, else keep all
            # when query is empty / catch-all smoke.
            if town and town not in q and "greater manchester" not in q:
                # Still allow phrase-only queries to surface all fixtures once.
                if not any(t in q for t in ("bolton", "oldham", "stockport", "wigan", "sale", "trafford")):
                    if hits:
                        continue
            hits.append(
                SearchHit(
                    title=data.get("title", path.stem),
                    url=data["original_post_url"],
                    snippet=data["raw_text"][:240],
                    source=data.get("source", "fixture"),
                    query=query,
                    raw_text=data["raw_text"],
                )
            )
            if len(hits) >= num:
                break
        # Fallback: if nothing matched a town-specific query, return first N fixtures
        if not hits:
            for path in sorted(self.fixtures_dir.glob("*.json"))[:num]:
                data = json.loads(path.read_text(encoding="utf-8"))
                hits.append(
                    SearchHit(
                        title=data.get("title", path.stem),
                        url=data["original_post_url"],
                        snippet=data["raw_text"][:240],
                        source=data.get("source", "fixture"),
                        query=query,
                        raw_text=data["raw_text"],
                    )
                )
        return hits[:num]


def load_all_fixture_hits(fixtures_dir: Path) -> list[SearchHit]:
    """Load every fixture once (ignores query matching)."""
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
