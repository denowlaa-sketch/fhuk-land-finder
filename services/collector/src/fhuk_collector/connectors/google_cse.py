from __future__ import annotations

import os

from fhuk_collector.models import SearchHit

from .http_util import build_query_url, http_get_json

GOOGLE_CSE_ENDPOINT = "https://www.googleapis.com/customsearch/v1"


class GoogleCustomSearchConnector:
    """
    Google Programmable Search (Custom Search JSON API).

    Env:
      GOOGLE_CSE_API_KEY
      GOOGLE_CSE_CX          # search engine ID
    """

    name = "google"

    def __init__(
        self,
        api_key: str | None = None,
        cx: str | None = None,
    ) -> None:
        self.api_key = (api_key if api_key is not None else os.getenv("GOOGLE_CSE_API_KEY", "")).strip()
        self.cx = (cx if cx is not None else os.getenv("GOOGLE_CSE_CX", "")).strip()
        if not self.api_key or not self.cx:
            raise RuntimeError(
                "Google CSE requires GOOGLE_CSE_API_KEY and GOOGLE_CSE_CX "
                "(set both on the collector host — not used by the Vercel web app)"
            )

    def search(self, query: str, *, num: int = 5) -> list[SearchHit]:
        url = build_query_url(
            GOOGLE_CSE_ENDPOINT,
            {
                "key": self.api_key,
                "cx": self.cx,
                "q": query,
                "num": max(1, min(num, 10)),
            },
        )
        payload = http_get_json(url)
        hits: list[SearchHit] = []
        for item in payload.get("items", []):
            snippet = item.get("snippet", "")
            hits.append(
                SearchHit(
                    title=item.get("title", ""),
                    url=item.get("link", ""),
                    snippet=snippet,
                    source="google_cse",
                    query=query,
                    # Snippet-only extract until a fetch layer is added;
                    # ownership confidence stays honest in the scorer.
                    raw_text=snippet,
                )
            )
        return hits
