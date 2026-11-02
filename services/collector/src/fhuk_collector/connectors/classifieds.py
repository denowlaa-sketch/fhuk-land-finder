from __future__ import annotations

import json
import os
import re
from pathlib import Path

from fhuk_collector.models import SearchHit

from .http_util import build_query_url, http_get_json
from .recorded import default_recorded_dir

# Public classified domains — live path uses search-engine site: filters only
# (no HTML scrape of listing pages; ToS-sensitive crawlers stay off by default).
SITE_DOMAINS: dict[str, str] = {
    "gumtree": "gumtree.com",
    "preloved": "preloved.co.uk",
    "freeads": "freeads.co.uk",
}

AGENT_SPAM_PATTERNS = re.compile(
    r"\b("
    r"estate\s*agents?|letting\s*agents?|rightmove|zoopla|onthemarket|"
    r"call\s+(our|the)\s+office|feefo|sales\s+negotiator|viewing\s+by\s+appointment\s+only|"
    r"commercial\s+agents?|land\s+agents?\s+ltd"
    r")\b",
    re.I,
)

PRIVATE_SIGNALS = re.compile(
    r"\b("
    r"private\s+sale|no\s+agents?|landowner|owner\s+selling|inherited|"
    r"back\s*garden|garden\s+plot|self[\s-]?build|no\s+planning|private\s+ad"
    r")\b",
    re.I,
)

GOOGLE_CSE_ENDPOINT = "https://www.googleapis.com/customsearch/v1"


def default_classifieds_recorded_path() -> Path:
    return default_recorded_dir() / "classifieds_gm.json"


def looks_like_agent_spam(text: str) -> bool:
    if AGENT_SPAM_PATTERNS.search(text or ""):
        # Allow if also strong private-sale language and "no agents"
        if re.search(r"\bno\s+agents?\b", text or "", re.I) and PRIVATE_SIGNALS.search(
            text or ""
        ):
            return False
        return True
    return False


def prefers_private_landowner(text: str) -> bool:
    return bool(PRIVATE_SIGNALS.search(text or ""))


class ClassifiedsSearchConnector:
    """
    Gumtree / Preloved / Freeads land ads for Greater Manchester.

    Default mode: offline recorded samples (hypothetical private landowner-style
    ads). Live mode (optional): Google CSE `site:` queries over public indexes —
    no direct classified-site HTML scraping (brittle / ToS-sensitive).

    Env:
      CLASSIFIEDS_RECORDED_PATH   override sample JSON
      CLASSIFIEDS_SITES           comma list (default gumtree,preloved,freeads)
      CLASSIFIEDS_LIVE            true to enable Google CSE site: search
      GOOGLE_CSE_API_KEY + GOOGLE_CSE_CX   required when CLASSIFIEDS_LIVE=true
    """

    name = "classifieds"

    def __init__(
        self,
        *,
        sites: list[str] | None = None,
        recorded_path: Path | None = None,
        live: bool | None = None,
    ) -> None:
        env_sites = os.getenv("CLASSIFIEDS_SITES", "")
        if sites is not None:
            self.sites = [s.lower().strip() for s in sites if s.strip()]
        elif env_sites.strip():
            self.sites = [s.strip().lower() for s in env_sites.split(",") if s.strip()]
        else:
            self.sites = list(SITE_DOMAINS.keys())
        for site in self.sites:
            if site not in SITE_DOMAINS:
                raise ValueError(
                    f"Unknown classifieds site {site!r}; "
                    f"choose from {', '.join(SITE_DOMAINS)}"
                )

        env_path = os.getenv("CLASSIFIEDS_RECORDED_PATH", "")
        self.recorded_path = (
            recorded_path
            or (Path(env_path) if env_path else None)
            or default_classifieds_recorded_path()
        )
        if live is None:
            live = os.getenv("CLASSIFIEDS_LIVE", "false").lower() in {
                "1",
                "true",
                "yes",
            }
        self.live = bool(live)
        self.api_key = os.getenv("GOOGLE_CSE_API_KEY", "")
        self.cx = os.getenv("GOOGLE_CSE_CX", "")
        self._payload = json.loads(self.recorded_path.read_text(encoding="utf-8"))

    def _listing_to_hit(self, item: dict, query: str) -> SearchHit | None:
        title = item.get("title") or "Classified land ad"
        body = (
            item.get("body")
            or item.get("description")
            or item.get("raw_text")
            or item.get("snippet")
            or ""
        )
        blob = f"{title}\n{body}"
        if looks_like_agent_spam(blob):
            return None
        site = (item.get("site") or "classifieds").lower()
        url = item.get("url") or item.get("link") or ""
        if not url:
            return None
        return SearchHit(
            title=title,
            url=url,
            snippet=body[:400],
            source=f"classifieds:{site}",
            query=query,
            raw_text=blob.strip(),
        )

    def _search_recorded(self, query: str, *, num: int) -> list[SearchHit]:
        q = query.lower()
        listings = [
            item
            for item in self._payload.get("listings", self._payload.get("items", []))
            if str(item.get("site", "")).lower() in self.sites
            or not item.get("site")
        ]
        scored: list[tuple[int, dict]] = []
        for item in listings:
            blob = (
                f"{item.get('title', '')} "
                f"{item.get('body', item.get('description', item.get('snippet', '')))}"
            ).lower()
            score = sum(1 for token in q.split() if len(token) > 3 and token in blob)
            if prefers_private_landowner(blob):
                score += 2
            if looks_like_agent_spam(blob):
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
                "CLASSIFIEDS_LIVE requires GOOGLE_CSE_API_KEY and GOOGLE_CSE_CX"
            )
        hits: list[SearchHit] = []
        per_site = max(1, num // max(1, len(self.sites)))
        for site in self.sites:
            domain = SITE_DOMAINS[site]
            site_query = f'site:{domain} {query} ("land" OR plot OR garden OR paddock)'
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
                if looks_like_agent_spam(blob):
                    continue
                hits.append(
                    SearchHit(
                        title=title,
                        url=link,
                        snippet=snippet,
                        source=f"classifieds:{site}:cse",
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


class GumtreeSearchConnector(ClassifiedsSearchConnector):
    name = "gumtree"

    def __init__(self, **kwargs) -> None:
        kwargs["sites"] = ["gumtree"]
        super().__init__(**kwargs)


class PrelovedSearchConnector(ClassifiedsSearchConnector):
    name = "preloved"

    def __init__(self, **kwargs) -> None:
        kwargs["sites"] = ["preloved"]
        super().__init__(**kwargs)


class FreeadsSearchConnector(ClassifiedsSearchConnector):
    name = "freeads"

    def __init__(self, **kwargs) -> None:
        kwargs["sites"] = ["freeads"]
        super().__init__(**kwargs)
