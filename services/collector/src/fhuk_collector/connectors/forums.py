from __future__ import annotations

import json
import os
from pathlib import Path

from fhuk_collector.models import SearchHit

from .recorded import default_recorded_dir


def default_forums_recorded_path() -> Path:
    return default_recorded_dir() / "uk_forums_gm.json"


class ForumSearchConnector:
    """
    Light UK property / self-build forum connector.

    Offline-first: replays recorded public-forum-style threads
    (samples/search/uk_forums_gm.json). No unofficial Facebook scraping.

    Optional live path later can reuse Google/Bing site: filters; this Phase
    keeps forums honest and fixture-driven unless FORUMS_RECORDED_PATH is set.
    """

    name = "forums"

    def __init__(self, recorded_path: Path | None = None) -> None:
        env_path = os.getenv("FORUMS_RECORDED_PATH", "")
        self.recorded_path = (
            recorded_path
            or (Path(env_path) if env_path else None)
            or default_forums_recorded_path()
        )
        self._payload = json.loads(self.recorded_path.read_text(encoding="utf-8"))

    def search(self, query: str, *, num: int = 5) -> list[SearchHit]:
        q = query.lower()
        threads = list(self._payload.get("threads", self._payload.get("items", [])))
        scored: list[tuple[int, dict]] = []
        for thread in threads:
            blob = (
                f"{thread.get('title', '')} {thread.get('body', thread.get('snippet', ''))}"
            ).lower()
            score = sum(1 for token in q.split() if len(token) > 3 and token in blob)
            scored.append((score, thread))
        scored.sort(key=lambda t: t[0], reverse=True)
        matched = [t for s, t in scored if s > 0]
        remainder = [t for s, t in scored if s <= 0]
        chosen = (matched + remainder)[:num]

        hits: list[SearchHit] = []
        for thread in chosen:
            title = thread.get("title", "UK forum thread")
            body = thread.get("body") or thread.get("raw_text") or thread.get("snippet") or ""
            url = thread.get("url") or thread.get("link") or ""
            board = thread.get("board", "uk_forum")
            hits.append(
                SearchHit(
                    title=title,
                    url=url,
                    snippet=body[:400],
                    source=f"forum:{board}",
                    query=query,
                    raw_text=f"{title}\n\n{body}".strip(),
                )
            )
        return hits
