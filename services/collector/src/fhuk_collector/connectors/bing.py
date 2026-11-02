from __future__ import annotations

import os

from fhuk_collector.models import SearchHit

from .http_util import build_query_url, http_get_json

BING_ENDPOINT = "https://api.bing.microsoft.com/v7.0/search"


class BingSearchConnector:
    """
    Bing Web Search API v7.

    Env:
      BING_SEARCH_API_KEY
    """

    name = "bing"

    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or os.getenv("BING_SEARCH_API_KEY", "")
        if not self.api_key:
            raise RuntimeError("Bing search requires BING_SEARCH_API_KEY")

    def search(self, query: str, *, num: int = 5) -> list[SearchHit]:
        url = build_query_url(
            BING_ENDPOINT,
            {
                "q": query,
                "count": max(1, min(num, 50)),
                "mkt": "en-GB",
                "safeSearch": "Moderate",
            },
        )
        payload = http_get_json(
            url,
            headers={
                "Ocp-Apim-Subscription-Key": self.api_key,
                "Accept": "application/json",
            },
        )
        hits: list[SearchHit] = []
        for item in payload.get("webPages", {}).get("value", []):
            snippet = item.get("snippet", "")
            hits.append(
                SearchHit(
                    title=item.get("name", ""),
                    url=item.get("url", ""),
                    snippet=snippet,
                    source="bing",
                    query=query,
                    raw_text=snippet,
                )
            )
        return hits
