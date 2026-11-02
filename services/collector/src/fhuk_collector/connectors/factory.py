from __future__ import annotations

import os
from pathlib import Path

from .auctions import (
    AuctionHouseSearchConnector,
    AuctionsSearchConnector,
    EgAuctionsSearchConnector,
    PlotbrowserSearchConnector,
    PlotfinderSearchConnector,
    SdlAuctionsSearchConnector,
    default_auctions_recorded_path,
)
from .base import SearchConnector
from .bing import BingSearchConnector
from .classifieds import (
    ClassifiedsSearchConnector,
    FreeadsSearchConnector,
    GumtreeSearchConnector,
    PrelovedSearchConnector,
    default_classifieds_recorded_path,
)
from .fixtures import FixtureSearchConnector
from .forums import ForumSearchConnector, default_forums_recorded_path
from .google_cse import GoogleCustomSearchConnector
from .recorded import RecordedSearchConnector, default_recorded_dir
from .reddit import RedditSearchConnector, default_reddit_recorded_path
from .stub import StubSearchConnector


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[5]


def available_providers() -> dict[str, str]:
    """provider → readiness note."""
    notes = {
        "auto": "Prefer google → bing → recorded based on env keys",
        "google": "Needs GOOGLE_CSE_API_KEY + GOOGLE_CSE_CX",
        "bing": "Needs BING_SEARCH_API_KEY",
        "reddit": "OAuth via REDDIT_CLIENT_ID/SECRET (+ USER_AGENT); else recorded sample",
        "forums": "Light UK property/self-build forum recorded samples (offline)",
        "classifieds": "Gumtree+Preloved+Freeads recorded GM ads; optional CSE site: live",
        "gumtree": "Gumtree-only classifieds (recorded / optional CSE site:)",
        "preloved": "Preloved-only classifieds (recorded / optional CSE site:)",
        "freeads": "Freeads-only classifieds (recorded / optional CSE site:)",
        "auctions": (
            "UK auction catalogues + Plotfinder/PlotBrowser recorded GM lots; "
            "optional CSE site: live"
        ),
        "auctionhouse": "Auction House-only (recorded / optional CSE site:)",
        "sdl": "SDL Auctions-only (recorded / optional CSE site:)",
        "eg": "EG Property Auctions-only (recorded / optional CSE site:)",
        "plotfinder": "Plotfinder specialist plots (recorded / optional CSE site:)",
        "plotbrowser": "PlotBrowser specialist plots (recorded / optional CSE site:)",
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
    Reddit/forums/classifieds/auctions are explicit providers (not part of auto).
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
    if chosen == "reddit":
        path = recorded_path or default_reddit_recorded_path()
        return RedditSearchConnector(recorded_path=path)
    if chosen == "forums":
        path = recorded_path or default_forums_recorded_path()
        return ForumSearchConnector(recorded_path=path)
    if chosen == "classifieds":
        path = recorded_path or default_classifieds_recorded_path()
        return ClassifiedsSearchConnector(recorded_path=path)
    if chosen == "gumtree":
        path = recorded_path or default_classifieds_recorded_path()
        return GumtreeSearchConnector(recorded_path=path)
    if chosen == "preloved":
        path = recorded_path or default_classifieds_recorded_path()
        return PrelovedSearchConnector(recorded_path=path)
    if chosen == "freeads":
        path = recorded_path or default_classifieds_recorded_path()
        return FreeadsSearchConnector(recorded_path=path)
    if chosen == "auctions":
        path = recorded_path or default_auctions_recorded_path()
        return AuctionsSearchConnector(recorded_path=path)
    if chosen == "auctionhouse":
        path = recorded_path or default_auctions_recorded_path()
        return AuctionHouseSearchConnector(recorded_path=path)
    if chosen == "sdl":
        path = recorded_path or default_auctions_recorded_path()
        return SdlAuctionsSearchConnector(recorded_path=path)
    if chosen == "eg":
        path = recorded_path or default_auctions_recorded_path()
        return EgAuctionsSearchConnector(recorded_path=path)
    if chosen == "plotfinder":
        path = recorded_path or default_auctions_recorded_path()
        return PlotfinderSearchConnector(recorded_path=path)
    if chosen == "plotbrowser":
        path = recorded_path or default_auctions_recorded_path()
        return PlotbrowserSearchConnector(recorded_path=path)
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
