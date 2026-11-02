from __future__ import annotations

import os
from pathlib import Path

from .base import SearchConnector
from .bing import BingSearchConnector
from .fixtures import FixtureSearchConnector
from .google_cse import GoogleCustomSearchConnector
from .recorded import RecordedSearchConnector, default_recorded_dir
from .stub import StubSearchConnector


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[5]


def available_providers() -> dict[str, str]:
    """provider → readiness note."""
    notes = {
        "auto": "Prefer google → bing → recorded based on env keys",
        "google": "Needs GOOGLE_CSE_API_KEY + GOOGLE_CSE_CX",
        "bing": "Needs BING_SEARCH_API_KEY",
        "recorded": "Offline replay of samples/search/*.json (default without keys)",
        "fixtures": "Offline fixture posts with full raw text",
        "stub": "Synthetic example.invalid URLs (no content)",
    }
    return notes


def resolve_connector(
    provider: str | None = None,
    *,
    fixtures_dir: Path | None = None,
    recorded_path: Path | None = None,
) -> SearchConnector:
    """
    Resolve a search connector.

    provider=auto (default): google if keys, else bing if key, else recorded.
    """
    chosen = (provider or os.getenv("SEARCH_PROVIDER") or "auto").lower().strip()
    fixtures = fixtures_dir or (_repo_root() / "fixtures")
    recorded = recorded_path or (default_recorded_dir() / "google_cse_gm.json")

    if chosen == "auto":
        if os.getenv("GOOGLE_CSE_API_KEY") and os.getenv("GOOGLE_CSE_CX"):
            return GoogleCustomSearchConnector()
        if os.getenv("BING_SEARCH_API_KEY"):
            return BingSearchConnector()
        return RecordedSearchConnector(recorded)

    if chosen == "google":
        return GoogleCustomSearchConnector()
    if chosen == "bing":
        return BingSearchConnector()
    if chosen == "recorded":
        return RecordedSearchConnector(recorded)
    if chosen == "fixtures":
        return FixtureSearchConnector(fixtures)
    if chosen == "stub":
        return StubSearchConnector()

    raise ValueError(
        f"Unknown SEARCH_PROVIDER={chosen!r}. "
        f"Choose from: {', '.join(available_providers())}"
    )
