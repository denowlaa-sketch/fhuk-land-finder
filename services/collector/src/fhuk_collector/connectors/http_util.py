from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


def http_get_json(url: str, *, headers: dict[str, str] | None = None, timeout: float = 30.0) -> dict[str, Any]:
    """Minimal GET JSON helper (stdlib only — lean deps)."""
    req = urllib.request.Request(url, headers=headers or {"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"HTTP {exc.code} for {url}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Request failed for {url}: {exc}") from exc
    return json.loads(body)


def build_query_url(base: str, params: dict[str, str | int]) -> str:
    return f"{base}?{urllib.parse.urlencode(params)}"
