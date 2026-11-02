from __future__ import annotations

from typing import Protocol, runtime_checkable

from fhuk_collector.models import SearchHit


@runtime_checkable
class SearchConnector(Protocol):
    """Public web search connector. No unofficial Facebook scrapers."""

    name: str

    def search(self, query: str, *, num: int = 5) -> list[SearchHit]:
        """Return public web hits for a query."""
        ...
