"""Backward-compatible search helpers. Prefer fhuk_collector.connectors."""

from __future__ import annotations

from pathlib import Path

from .connectors.fixtures import load_all_fixture_hits
from .connectors.stub import StubSearchConnector
from .models import SearchHit


def stub_search(queries: list[str], limit_per_query: int = 1) -> list[SearchHit]:
    connector = StubSearchConnector()
    hits: list[SearchHit] = []
    for query in queries[:50]:
        hits.extend(connector.search(query, num=limit_per_query))
    return hits


def load_fixture_hits(fixtures_dir: Path) -> list[SearchHit]:
    return load_all_fixture_hits(fixtures_dir)
