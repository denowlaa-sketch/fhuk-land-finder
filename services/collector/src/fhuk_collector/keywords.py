from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

# Active keyword libraries under data/keywords/ (slug → filename stem).
DEFAULT_REGION_SLUGS: tuple[str, ...] = (
    "greater-manchester",
    "west-yorkshire",
    "merseyside",
    "lancashire",
    "cheshire",
    "west-midlands",
)


def keywords_dir() -> Path:
    # services/collector/src/fhuk_collector → repo root (parents[4])
    return Path(__file__).resolve().parents[4] / "data" / "keywords"


def geography_coverage_path() -> Path:
    return Path(__file__).resolve().parents[4] / "data" / "geography" / "coverage.json"


def default_keywords_path() -> Path:
    """Single-file default (GM) — prefer resolve_region_slugs() + load for multi-region."""
    return keywords_dir() / "greater-manchester.json"


def resolve_region_slugs(region: str | None = None) -> list[str]:
    """
    Resolve which keyword libraries to use.

    COLLECTOR_REGION / region arg:
      - unset / \"all\" → every DEFAULT_REGION_SLUGS entry
      - comma-separated slugs → those that exist on disk
      - single slug → that file
    """
    raw = (region if region is not None else os.getenv("COLLECTOR_REGION", "all")).strip()
    if not raw or raw.lower() in {"all", "*"}:
        return list(DEFAULT_REGION_SLUGS)
    slugs = [s.strip().lower().replace(" ", "-") for s in raw.split(",") if s.strip()]
    known = set(DEFAULT_REGION_SLUGS)
    # Allow unknown slugs if the JSON file exists (forward-compatible).
    resolved: list[str] = []
    for slug in slugs:
        path = keywords_dir() / f"{slug}.json"
        if slug in known or path.is_file():
            if slug not in resolved:
                resolved.append(slug)
    return resolved or list(DEFAULT_REGION_SLUGS)


def load_keywords(
    path: Path | None = None,
    *,
    region: str | None = None,
) -> dict[str, Any]:
    """
    Load one seed file, or merge all resolved regions into a combined seed.

    Combined seeds set region to a comma-joined label and concatenate towns /
    priority_towns (phrases deduped). Used by the pipeline summary + expanders.
    """
    if path is not None:
        with path.open(encoding="utf-8") as f:
            return json.load(f)

    slugs = resolve_region_slugs(region)
    if len(slugs) == 1:
        return _load_slug(slugs[0])

    seeds = [_load_slug(s) for s in slugs]
    return merge_seeds(seeds)


def _load_slug(slug: str) -> dict[str, Any]:
    p = keywords_dir() / f"{slug}.json"
    with p.open(encoding="utf-8") as f:
        data = json.load(f)
    data["_slug"] = slug
    return data


def list_region_seeds(*, region: str | None = None) -> list[dict[str, Any]]:
    return [_load_slug(s) for s in resolve_region_slugs(region)]


def merge_seeds(seeds: list[dict[str, Any]]) -> dict[str, Any]:
    if not seeds:
        return {
            "region": "UK",
            "towns": [],
            "priority_towns": [],
            "phrases": [],
            "query_template": "{phrase} {town}",
        }
    if len(seeds) == 1:
        return seeds[0]

    towns: list[str] = []
    priority: list[str] = []
    phrases: list[str] = []
    for seed in seeds:
        for t in seed.get("towns", []):
            if t not in towns:
                towns.append(t)
        for t in _priority_towns(seed):
            if t not in priority:
                priority.append(t)
        for p in seed.get("phrases", []):
            if p not in phrases:
                phrases.append(p)

    return {
        "region": ", ".join(str(s.get("region", "")) for s in seeds if s.get("region")),
        "version": max(int(s.get("version", 1)) for s in seeds),
        "towns": towns,
        "priority_towns": priority,
        "phrases": phrases,
        "query_template": seeds[0].get("query_template", "{phrase} {town}"),
        "regions": [s.get("region") for s in seeds],
        "notes": "Merged multi-region keyword seed.",
    }


def _priority_towns(data: dict[str, Any]) -> list[str]:
    explicit = data.get("priority_towns")
    if explicit:
        return list(explicit)
    towns = list(data.get("towns", []))
    return towns[:8]


def load_coverage_towns() -> list[str]:
    """Lowercase town tokens for extract / scoring geography checks."""
    path = geography_coverage_path()
    if not path.is_file():
        return []
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    return [str(t).lower() for t in data.get("towns", [])]


# Extra landowner / sale-intent phrases for Reddit & forums (aligned with seed).
REDDIT_EXTRA_PHRASES = [
    "land for sale",
    "inherited land",
    "garden plot",
    "no planning",
    "private sale plot",
    "back garden for sale",
    "self build plot",
    "landowner selling",
]


def expand_queries(
    seed: dict[str, Any] | None = None,
    *,
    region: str | None = None,
) -> list[str]:
    """Build phrase × town query list for the active region(s)."""
    if seed is not None:
        return _expand_seed_queries(seed)

    queries: list[str] = []
    for part in list_region_seeds(region=region):
        queries.extend(_expand_seed_queries(part))
    return queries


def _expand_seed_queries(data: dict[str, Any]) -> list[str]:
    towns: list[str] = list(data["towns"])
    phrases: list[str] = list(data["phrases"])
    template: str = data.get("query_template", "{phrase} {town}")
    queries: list[str] = []
    for phrase in phrases:
        for town in towns:
            queries.append(
                template.format(phrase=phrase, town=town, region=data.get("region", ""))
            )
    return queries


def expand_reddit_queries(
    seed: dict[str, Any] | None = None,
    *,
    priority_towns: list[str] | None = None,
    region: str | None = None,
) -> list[str]:
    """
    Reddit/forum-oriented queries: seed phrases + extras × priority towns,
    plus region-level phrase queries (fewer, higher signal for subreddit search).
    """
    if seed is not None:
        return _expand_channel_queries(
            seed,
            extras=REDDIT_EXTRA_PHRASES,
            priority_towns=priority_towns,
        )

    queries: list[str] = []
    for part in list_region_seeds(region=region):
        queries.extend(
            _expand_channel_queries(
                part,
                extras=REDDIT_EXTRA_PHRASES,
                priority_towns=priority_towns,
            )
        )
    return list(dict.fromkeys(queries))


CLASSIFIEDS_EXTRA_PHRASES = [
    "land for sale privately",
    "garden plot private sale",
    "no agents land",
    "inherited land for sale",
    "back garden for sale",
    "building plot private",
    "paddock for sale",
    "self build plot",
]


def expand_classifieds_queries(
    seed: dict[str, Any] | None = None,
    *,
    priority_towns: list[str] | None = None,
    region: str | None = None,
) -> list[str]:
    """Classifieds queries: seed + private-sale phrases × priority towns per region."""
    if seed is not None:
        return _expand_channel_queries(
            seed,
            extras=CLASSIFIEDS_EXTRA_PHRASES,
            priority_towns=priority_towns,
        )

    queries: list[str] = []
    for part in list_region_seeds(region=region):
        queries.extend(
            _expand_channel_queries(
                part,
                extras=CLASSIFIEDS_EXTRA_PHRASES,
                priority_towns=priority_towns,
            )
        )
    return list(dict.fromkeys(queries))


AUCTIONS_EXTRA_PHRASES = [
    "building plot auction",
    "development land lot",
    "self build plot",
    "garden plot auction",
    "paddock for sale auction",
    "land with planning permission",
    "brownfield development land",
    "outline planning plot",
]


def expand_auctions_queries(
    seed: dict[str, Any] | None = None,
    *,
    priority_towns: list[str] | None = None,
    region: str | None = None,
) -> list[str]:
    """Auction / specialist-plot queries: seed + lot phrases × priority towns per region."""
    if seed is not None:
        return _expand_channel_queries(
            seed,
            extras=AUCTIONS_EXTRA_PHRASES,
            priority_towns=priority_towns,
        )

    queries: list[str] = []
    for part in list_region_seeds(region=region):
        queries.extend(
            _expand_channel_queries(
                part,
                extras=AUCTIONS_EXTRA_PHRASES,
                priority_towns=priority_towns,
            )
        )
    return list(dict.fromkeys(queries))


def _expand_channel_queries(
    data: dict[str, Any],
    *,
    extras: list[str],
    priority_towns: list[str] | None,
) -> list[str]:
    region_name = str(data.get("region", "UK"))
    towns = priority_towns or _priority_towns(data)
    phrases = list(dict.fromkeys([*data.get("phrases", []), *extras]))
    queries: list[str] = []
    for phrase in phrases:
        queries.append(f"{phrase} {region_name}")
        for town in towns:
            queries.append(f"{phrase} {town}")
    return queries
