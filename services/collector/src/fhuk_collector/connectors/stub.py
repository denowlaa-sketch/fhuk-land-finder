from __future__ import annotations

from fhuk_collector.models import SearchHit


class StubSearchConnector:
    """Synthetic hits — no HTTP. Useful for wiring tests without samples."""

    name = "stub"

    def search(self, query: str, *, num: int = 5) -> list[SearchHit]:
        hits: list[SearchHit] = []
        slug = query.lower().replace(" ", "-")[:60]
        for n in range(max(1, num)):
            url = f"https://example.invalid/stub/{slug}/{n}"
            hits.append(
                SearchHit(
                    title=f"Stub result for: {query}",
                    url=url,
                    snippet=(
                        f"Hypothetical public web mention matching “{query}”. "
                        "Use SEARCH_PROVIDER=recorded|google|bing for real shapes."
                    ),
                    source=self.name,
                    query=query,
                    raw_text=None,
                )
            )
        return hits
