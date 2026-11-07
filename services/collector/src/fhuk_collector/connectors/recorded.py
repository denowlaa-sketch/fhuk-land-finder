from __future__ import annotations

import json
from pathlib import Path

from fhuk_collector.models import SearchHit


def default_recorded_dir() -> Path:
    # connectors → fhuk_collector → src → collector
    return Path(__file__).resolve().parents[3] / "samples" / "search"


class RecordedSearchConnector:
    """
    Offline connector that replays recorded Google CSE / Bing-shaped JSON.

    Used when no API keys are set. Sample payload ships under
    services/collector/samples/search/.
    """

    name = "recorded"

    def __init__(self, sample_path: Path | None = None) -> None:
        self.sample_path = sample_path or (
            default_recorded_dir() / "google_cse_gm.json"
        )
        self._payload = json.loads(self.sample_path.read_text(encoding="utf-8"))

    def search(self, query: str, *, num: int = 5) -> list[SearchHit]:
        q = query.lower()
        items = list(self._payload.get("items", []))
        # Prefer items whose title/snippet mention a town from the query.
        scored: list[tuple[int, dict]] = []
        for item in items:
            blob = f"{item.get('title', '')} {item.get('snippet', '')}".lower()
            score = sum(1 for token in q.split() if len(token) > 3 and token in blob)
            scored.append((score, item))
        scored.sort(key=lambda t: t[0], reverse=True)

        matched = [it for score, it in scored if score > 0]
        remainder = [it for score, it in scored if score <= 0]
        # Prefer query matches, then backfill so offline smoke still surfaces
        # the full recorded sample set (historically GM-labelled).
        chosen = (matched + remainder)[:num]

        hits: list[SearchHit] = []
        for item in chosen:
            raw = item.get("raw_text") or item.get("snippet") or ""
            hits.append(
                SearchHit(
                    title=item.get("title", "Recorded hit"),
                    url=item.get("link") or item.get("url") or "",
                    snippet=item.get("snippet", "")[:400],
                    source="recorded_search",
                    query=query,
                    raw_text=raw,
                )
            )
        return hits
