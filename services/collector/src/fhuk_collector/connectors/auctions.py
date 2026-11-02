from __future__ import annotations

import json
import os
import re
from pathlib import Path

from fhuk_collector.models import SearchHit

from .http_util import build_query_url, http_get_json
from .recorded import default_recorded_dir

# UK property auction catalogues + specialist development-land listing sites.
# Live path uses search-engine site: filters only (no HTML scrape of catalogue
# pages; ToS-sensitive / brittle crawlers stay off by default).
SITE_DOMAINS: dict[str, str] = {
    "auctionhouse": "auctionhouse.co.uk",
    "sdl": "sdlauctions.co.uk",
    "eg": "egpropertyauctions.co.uk",
    "plotfinder": "plotfinder.net",
    "plotbrowser": "plotbrowser.com",
}

# Pure residential house-lot noise (not development land).
RESIDENTIAL_NOISE = re.compile(
    r"\b("
    r"\d[\s-]*bed(room)?s?\s+(semi|detached|terraced|flat|apartment)|"
    r"leasehold\s+flat|tenanted\s+investment|"
    r"hmo\s+investment|buy[\s-]?to[\s-]?let"
    r")\b",
    re.I,
)

LAND_SIGNALS = re.compile(
    r"\b("
    r"building\s+plot|development\s+land|self[\s-]?build|"
    r"garden\s+plot|paddock|amenity\s+land|brownfield|"
    r"outline\s+planning|planning\s+permission|"
    r"land\s+with\s+pp|guide\s+price|"
    r"freehold\s+land|infill|backland"
    r")\b",
    re.I,
)

GOOGLE_CSE_ENDPOINT = "https://www.googleapis.com/customsearch/v1"


def default_auctions_recorded_path() -> Path:
    return default_recorded_dir() / "auctions_gm.json"


def looks_like_residential_noise(text: str) -> bool:
    """Drop pure house/flat auction lots unless land/plot language is present."""
    blob = text or ""
    if LAND_SIGNALS.search(blob):
        return False
    return bool(RESIDENTIAL_NOISE.search(blob))


def prefers_land_lot(text: str) -> bool:
    return bool(LAND_SIGNALS.search(text or ""))


class AuctionsSearchConnector:
    """
    UK property auction catalogues + specialist development-land listings
    (Auction House, SDL, EG Property Auctions, Plotfinder, PlotBrowser).

    Default mode: offline recorded samples (hypothetical GM/UK land lots).
    Live mode (optional): Google CSE `site:` queries over public indexes —
    no direct auction/plot-site HTML scraping (brittle / ToS-sensitive).

    Env:
      AUCTIONS_RECORDED_PATH   override sample JSON
      AUCTIONS_SITES           comma list (default all SITE_DOMAINS)
      AUCTIONS_LIVE            true to enable Google CSE site: search
      GOOGLE_CSE_API_KEY + GOOGLE_CSE_CX   required when AUCTIONS_LIVE=true
    """

    name = "auctions"

    def __init__(
        self,
        *,
        sites: list[str] | None = None,
        recorded_path: Path | None = None,
        live: bool | None = None,
    ) -> None:
        env_sites = os.getenv("AUCTIONS_SITES", "")
        if sites is not None:
            self.sites = [s.lower().strip() for s in sites if s.strip()]
        elif env_sites.strip():
            self.sites = [s.strip().lower() for s in env_sites.split(",") if s.strip()]
        else:
            self.sites = list(SITE_DOMAINS.keys())
        for site in self.sites:
            if site not in SITE_DOMAINS:
                raise ValueError(
                    f"Unknown auctions site {site!r}; "
                    f"choose from {', '.join(SITE_DOMAINS)}"
                )

        env_path = os.getenv("AUCTIONS_RECORDED_PATH", "")
        self.recorded_path = (
            recorded_path
            or (Path(env_path) if env_path else None)
            or default_auctions_recorded_path()
        )
        if live is None:
            live = os.getenv("AUCTIONS_LIVE", "false").lower() in {
                "1",
                "true",
                "yes",
            }
        self.live = bool(live)
        self.api_key = os.getenv("GOOGLE_CSE_API_KEY", "")
        self.cx = os.getenv("GOOGLE_CSE_CX", "")
        self._payload = json.loads(self.recorded_path.read_text(encoding="utf-8"))

    def _listing_to_hit(self, item: dict, query: str) -> SearchHit | None:
        title = item.get("title") or "Auction / land listing"
        body = (
            item.get("body")
            or item.get("description")
            or item.get("raw_text")
            or item.get("snippet")
            or ""
        )
        blob = f"{title}\n{body}"
        if looks_like_residential_noise(blob):
            return None
        site = (item.get("site") or "auctions").lower()
        url = item.get("url") or item.get("link") or ""
        if not url:
            return None
        return SearchHit(
            title=title,
            url=url,
            snippet=body[:400],
            source=f"auctions:{site}",
            query=query,
            raw_text=blob.strip(),
        )

    def _search_recorded(self, query: str, *, num: int) -> list[SearchHit]:
        q = query.lower()
        listings = [
            item
            for item in self._payload.get("listings", self._payload.get("items", []))
            if str(item.get("site", "")).lower() in self.sites or not item.get("site")
        ]
        scored: list[tuple[int, dict]] = []
        for item in listings:
            blob = (
                f"{item.get('title', '')} "
                f"{item.get('body', item.get('description', item.get('snippet', '')))}"
            ).lower()
            score = sum(1 for token in q.split() if len(token) > 3 and token in blob)
            if prefers_land_lot(blob):
                score += 2
            if looks_like_residential_noise(blob):
                score -= 5
            scored.append((score, item))
        scored.sort(key=lambda t: t[0], reverse=True)
        matched = [it for s, it in scored if s > 0]
        remainder = [it for s, it in scored if s <= 0]
        chosen = matched + remainder

        hits: list[SearchHit] = []
        for item in chosen:
            hit = self._listing_to_hit(item, query)
            if hit:
                hits.append(hit)
            if len(hits) >= num:
                break
        return hits

    def _search_google_site(self, query: str, *, num: int) -> list[SearchHit]:
        if not self.api_key or not self.cx:
            raise RuntimeError(
                "AUCTIONS_LIVE requires GOOGLE_CSE_API_KEY and GOOGLE_CSE_CX"
            )
        hits: list[SearchHit] = []
        per_site = max(1, num // max(1, len(self.sites)))
        for site in self.sites:
            domain = SITE_DOMAINS[site]
            site_query = (
                f'site:{domain} {query} '
                f'("building plot" OR "development land" OR paddock OR '
                f'"self build" OR "garden plot" OR lot)'
            )
            url = build_query_url(
                GOOGLE_CSE_ENDPOINT,
                {
                    "key": self.api_key,
                    "cx": self.cx,
                    "q": site_query,
                    "num": max(1, min(per_site, 10)),
                },
            )
            payload = http_get_json(url)
            for item in payload.get("items", []):
                title = item.get("title", "")
                snippet = item.get("snippet", "")
                link = item.get("link", "")
                blob = f"{title}\n{snippet}"
                if looks_like_residential_noise(blob):
                    continue
                hits.append(
                    SearchHit(
                        title=title,
                        url=link,
                        snippet=snippet,
                        source=f"auctions:{site}:cse",
                        query=query,
                        raw_text=blob.strip(),
                    )
                )
                if len(hits) >= num:
                    return hits[:num]
        return hits[:num]

    def search(self, query: str, *, num: int = 5) -> list[SearchHit]:
        if self.live:
            try:
                live_hits = self._search_google_site(query, num=num)
                if live_hits:
                    return live_hits
            except RuntimeError:
                # Fall through to recorded when live path misconfigured.
                pass
        return self._search_recorded(query, num=num)


class AuctionHouseSearchConnector(AuctionsSearchConnector):
    name = "auctionhouse"

    def __init__(self, **kwargs) -> None:
        kwargs["sites"] = ["auctionhouse"]
        super().__init__(**kwargs)


class SdlAuctionsSearchConnector(AuctionsSearchConnector):
    name = "sdl"

    def __init__(self, **kwargs) -> None:
        kwargs["sites"] = ["sdl"]
        super().__init__(**kwargs)


class EgAuctionsSearchConnector(AuctionsSearchConnector):
    name = "eg"

    def __init__(self, **kwargs) -> None:
        kwargs["sites"] = ["eg"]
        super().__init__(**kwargs)


class PlotfinderSearchConnector(AuctionsSearchConnector):
    name = "plotfinder"

    def __init__(self, **kwargs) -> None:
        kwargs["sites"] = ["plotfinder"]
        super().__init__(**kwargs)


class PlotbrowserSearchConnector(AuctionsSearchConnector):
    name = "plotbrowser"

    def __init__(self, **kwargs) -> None:
        kwargs["sites"] = ["plotbrowser"]
        super().__init__(**kwargs)
