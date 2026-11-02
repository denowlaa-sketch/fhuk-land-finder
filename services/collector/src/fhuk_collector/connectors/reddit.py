from __future__ import annotations

import os
from pathlib import Path

from fhuk_collector.models import SearchHit

from .http_util import basic_auth_header, build_query_url, http_get_json, http_post_form
from .recorded import default_recorded_dir

DEFAULT_SUBREDDITS = (
    "SelfBuild",
    "HousingUK",
    "manchester",
    "UKProperty",
    "AskUK",
)

TOKEN_URL = "https://www.reddit.com/api/v1/access_token"
OAUTH_SEARCH = "https://oauth.reddit.com/search"
PUBLIC_SEARCH = "https://www.reddit.com/search.json"


def default_reddit_recorded_path() -> Path:
    return default_recorded_dir() / "reddit_gm.json"


class RedditSearchConnector:
    """
    Reddit search via official OAuth (preferred) or public JSON.

    Env:
      REDDIT_CLIENT_ID
      REDDIT_CLIENT_SECRET
      REDDIT_USER_AGENT   (required for live calls; Reddit policy)
      REDDIT_SUBREDDITS   (optional comma list)

    Without client credentials, replays recorded UK land/self-build style posts
    from samples/search/reddit_gm.json (offline smoke).
    """

    name = "reddit"

    def __init__(
        self,
        *,
        client_id: str | None = None,
        client_secret: str | None = None,
        user_agent: str | None = None,
        subreddits: list[str] | None = None,
        recorded_path: Path | None = None,
        allow_public_json: bool | None = None,
    ) -> None:
        self.client_id = client_id or os.getenv("REDDIT_CLIENT_ID", "")
        self.client_secret = client_secret or os.getenv("REDDIT_CLIENT_SECRET", "")
        self.user_agent = user_agent or os.getenv(
            "REDDIT_USER_AGENT",
            "fhuk-land-finder/0.1 (Greater Manchester land sourcing; contact: local-dev)",
        )
        env_subs = os.getenv("REDDIT_SUBREDDITS", "")
        if subreddits is not None:
            self.subreddits = subreddits
        elif env_subs.strip():
            self.subreddits = [s.strip() for s in env_subs.split(",") if s.strip()]
        else:
            self.subreddits = list(DEFAULT_SUBREDDITS)
        self.recorded_path = recorded_path or default_reddit_recorded_path()
        if allow_public_json is None:
            allow_public_json = os.getenv("REDDIT_ALLOW_PUBLIC_JSON", "false").lower() in {
                "1",
                "true",
                "yes",
            }
        self.allow_public_json = allow_public_json
        self._token: str | None = None

    @property
    def live(self) -> bool:
        return bool(self.client_id and self.client_secret)

    def _headers(self, *, bearer: str | None = None) -> dict[str, str]:
        headers = {
            "User-Agent": self.user_agent,
            "Accept": "application/json",
        }
        if bearer:
            headers["Authorization"] = f"Bearer {bearer}"
        return headers

    def _access_token(self) -> str:
        if self._token:
            return self._token
        payload = http_post_form(
            TOKEN_URL,
            {"grant_type": "client_credentials"},
            headers={
                "Authorization": basic_auth_header(self.client_id, self.client_secret),
                "User-Agent": self.user_agent,
            },
        )
        token = payload.get("access_token")
        if not token:
            raise RuntimeError("Reddit token response missing access_token")
        self._token = str(token)
        return self._token

    def _parse_listing(self, payload: dict, query: str) -> list[SearchHit]:
        hits: list[SearchHit] = []
        children = payload.get("data", {}).get("children", [])
        for child in children:
            data = child.get("data") or {}
            title = data.get("title") or ""
            selftext = data.get("selftext") or ""
            permalink = data.get("permalink") or ""
            url = data.get("url") or ""
            if permalink.startswith("/"):
                post_url = f"https://www.reddit.com{permalink}"
            elif permalink:
                post_url = permalink
            else:
                post_url = url
            if not post_url:
                continue
            sub = data.get("subreddit") or ""
            snippet = (selftext or title)[:400]
            raw = f"{title}\n\n{selftext}".strip()
            hits.append(
                SearchHit(
                    title=title or f"Reddit post in r/{sub}",
                    url=post_url,
                    snippet=snippet,
                    source=f"reddit:{sub}" if sub else "reddit",
                    query=query,
                    raw_text=raw,
                )
            )
        return hits

    def _search_oauth(self, query: str, *, num: int) -> list[SearchHit]:
        token = self._access_token()
        # Restrict to configured UK / self-build subreddits when possible.
        sub_filter = "+".join(self.subreddits)
        url = build_query_url(
            OAUTH_SEARCH,
            {
                "q": query,
                "restrict_sr": "false",
                "sort": "new",
                "limit": max(1, min(num, 25)),
                "raw_json": 1,
                # Hint via query; also try subreddit multi-search path below.
            },
        )
        # Prefer multi-subreddit search endpoint when subs configured.
        if self.subreddits:
            multi = "+".join(self.subreddits)
            url = build_query_url(
                f"https://oauth.reddit.com/r/{multi}/search",
                {
                    "q": query,
                    "restrict_sr": "on",
                    "sort": "new",
                    "limit": max(1, min(num, 25)),
                    "raw_json": 1,
                },
            )
        payload = http_get_json(url, headers=self._headers(bearer=token))
        hits = self._parse_listing(payload, query)
        # If subreddit-restricted search is empty, fall back to global search
        # still labelled as reddit (ownership confidence stays honest downstream).
        if not hits and sub_filter:
            url = build_query_url(
                OAUTH_SEARCH,
                {
                    "q": f"({query}) (UK OR Manchester OR Bolton OR \"self build\")",
                    "sort": "new",
                    "limit": max(1, min(num, 25)),
                    "raw_json": 1,
                },
            )
            payload = http_get_json(url, headers=self._headers(bearer=token))
            hits = self._parse_listing(payload, query)
        return hits[:num]

    def _search_public_json(self, query: str, *, num: int) -> list[SearchHit]:
        multi = "+".join(self.subreddits) if self.subreddits else "SelfBuild"
        url = build_query_url(
            f"https://www.reddit.com/r/{multi}/search.json",
            {
                "q": query,
                "restrict_sr": "on",
                "sort": "new",
                "limit": max(1, min(num, 25)),
            },
        )
        payload = http_get_json(url, headers=self._headers())
        return self._parse_listing(payload, query)[:num]

    def _search_recorded(self, query: str, *, num: int) -> list[SearchHit]:
        import json

        payload = json.loads(self.recorded_path.read_text(encoding="utf-8"))
        q = query.lower()
        items = list(payload.get("posts", payload.get("items", [])))
        scored: list[tuple[int, dict]] = []
        for item in items:
            blob = f"{item.get('title', '')} {item.get('selftext', item.get('snippet', ''))}".lower()
            score = sum(1 for token in q.split() if len(token) > 3 and token in blob)
            scored.append((score, item))
        scored.sort(key=lambda t: t[0], reverse=True)
        matched = [it for s, it in scored if s > 0]
        remainder = [it for s, it in scored if s <= 0]
        chosen = (matched + remainder)[:num]

        hits: list[SearchHit] = []
        for item in chosen:
            title = item.get("title", "Recorded Reddit post")
            selftext = item.get("selftext") or item.get("raw_text") or item.get("snippet") or ""
            permalink = item.get("permalink") or item.get("link") or item.get("url") or ""
            if permalink.startswith("/"):
                post_url = f"https://www.reddit.com{permalink}"
            else:
                post_url = permalink
            sub = item.get("subreddit", "recorded")
            hits.append(
                SearchHit(
                    title=title,
                    url=post_url,
                    snippet=selftext[:400],
                    source=f"reddit_recorded:{sub}",
                    query=query,
                    raw_text=f"{title}\n\n{selftext}".strip(),
                )
            )
        return hits

    def search(self, query: str, *, num: int = 5) -> list[SearchHit]:
        if self.live:
            return self._search_oauth(query, num=num)
        if self.allow_public_json:
            try:
                return self._search_public_json(query, num=num)
            except RuntimeError:
                return self._search_recorded(query, num=num)
        return self._search_recorded(query, num=num)
