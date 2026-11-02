from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def default_keywords_path() -> Path:
    # services/collector/src/fhuk_collector → repo root (parents[4])
    return (
        Path(__file__).resolve().parents[4]
        / "data"
        / "keywords"
        / "greater-manchester.json"
    )


def load_keywords(path: Path | None = None) -> dict[str, Any]:
    p = path or default_keywords_path()
    with p.open(encoding="utf-8") as f:
        return json.load(f)


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


def expand_queries(seed: dict[str, Any] | None = None) -> list[str]:
    """Build phrase × town query list for the pilot region."""
    data = seed or load_keywords()
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
) -> list[str]:
    """
    Reddit/forum-oriented queries: seed phrases + extras × priority towns,
    plus region-level phrase queries (fewer, higher signal for subreddit search).
    """
    data = seed or load_keywords()
    region = str(data.get("region", "Greater Manchester"))
    towns = priority_towns or [
        "Manchester",
        "Bolton",
        "Oldham",
        "Stockport",
        "Wigan",
        "Sale",
        "Trafford",
        "Salford",
    ]
    phrases = list(dict.fromkeys([*data.get("phrases", []), *REDDIT_EXTRA_PHRASES]))
    queries: list[str] = []
    for phrase in phrases:
        queries.append(f"{phrase} {region}")
        for town in towns:
            queries.append(f"{phrase} {town}")
    return queries
