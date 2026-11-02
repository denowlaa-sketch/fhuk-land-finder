from __future__ import annotations

import json
import os
import re
from typing import Any

from .dedupe import content_hash
from .models import ExtractedLead, SearchHit
from .prompts import EXTRACT_SYSTEM, build_extract_user_prompt

VALID_OPP = {
    "backland",
    "garden_plot",
    "brownfield",
    "infill",
    "agricultural",
    "other",
}
VALID_PLAN = {"none", "pre_app", "outline", "full", "expired", "unknown"}
VALID_OWN = {"confirmed", "likely", "possible", "unknown"}
VALID_AI = {"Strong", "Investigate", "Reject"}


def _heuristic_extract(hit: SearchHit) -> dict[str, Any]:
    """Offline fallback when OPENAI_API_KEY is unset — keyword heuristics only."""
    text = (hit.raw_text or hit.snippet or "").lower()
    assessment = "Investigate"
    rationale = "Heuristic Phase 0 fallback (no OpenAI key)."
    if any(w in text for w in ("green belt", "not a building plot", "agricultural only")):
        assessment = "Reject"
        rationale = "Heuristic: explicit non-development / amenity-only signal."
    elif any(
        w in text
        for w in ("selling", "for sale", "private sale", "outline planning", "guide £")
    ) and any(w in text for w in ("garden", "plot", "yard", "land", "backland")):
        assessment = "Strong"
        rationale = "Heuristic: sale intent + land/plot language."

    opp = "other"
    for key, label in [
        ("brownfield", "brownfield"),
        ("back", "backland"),
        ("garden", "garden_plot"),
        ("infill", "infill"),
        ("paddock", "agricultural"),
        ("agricultural", "agricultural"),
    ]:
        if key in text:
            opp = label
            break

    price = None
    m = re.search(r"£\s?([\d,]+)", hit.raw_text or hit.snippet or "")
    if m:
        price = float(m.group(1).replace(",", ""))

    planning = "unknown"
    if "outline" in text:
        planning = "outline"
    elif "no planning" in text or "no current planning" in text:
        planning = "none"

    return {
        "location": hit.query or "Unknown UK",
        "opportunity_type": opp,
        "land_size": None,
        "asking_price": price,
        "planning_status": planning,
        "landowner_name": None,
        "contact": None,
        "ownership_confidence": "possible",
        "seller_motivation": None,
        "ai_assessment": assessment,
        "ai_rationale": rationale,
    }


def _parse_json_payload(content: str) -> dict[str, Any]:
    content = content.strip()
    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```$", "", content)
    return json.loads(content)


def _coerce(data: dict[str, Any], hit: SearchHit) -> ExtractedLead:
    opp = data.get("opportunity_type", "other")
    if opp not in VALID_OPP:
        opp = "other"
    plan = data.get("planning_status", "unknown")
    if plan not in VALID_PLAN:
        plan = "unknown"
    own = data.get("ownership_confidence", "unknown")
    if own not in VALID_OWN:
        own = "unknown"
    ai = data.get("ai_assessment", "Investigate")
    if ai not in VALID_AI:
        ai = "Investigate"

    price = data.get("asking_price")
    if isinstance(price, str):
        try:
            price = float(price.replace("£", "").replace(",", "").strip())
        except ValueError:
            price = None
    if price is not None:
        try:
            price = float(price)
        except (TypeError, ValueError):
            price = None

    excerpt = hit.raw_text or hit.snippet
    location = str(data.get("location") or hit.query or "Unknown")
    contact = data.get("contact")
    ch = content_hash(
        url=hit.url,
        location=location,
        contact=str(contact) if contact else None,
        excerpt=excerpt,
    )
    return ExtractedLead(
        location=location,
        opportunity_type=opp,  # type: ignore[arg-type]
        land_size=data.get("land_size"),
        asking_price=price,
        planning_status=plan,  # type: ignore[arg-type]
        landowner_name=data.get("landowner_name"),
        contact=str(contact) if contact else None,
        ownership_confidence=own,  # type: ignore[arg-type]
        seller_motivation=data.get("seller_motivation"),
        ai_assessment=ai,  # type: ignore[arg-type]
        ai_rationale=str(data.get("ai_rationale") or ""),
        source=hit.source,
        original_post_url=hit.url,
        raw_excerpt=excerpt,
        content_hash=ch,
    )


def extract_and_score(hit: SearchHit, *, model: str | None = None) -> ExtractedLead:
    """Extract + score a search hit via OpenAI, or heuristic fallback."""
    api_key = os.getenv("OPENAI_API_KEY")
    text = hit.raw_text or hit.snippet
    if not api_key:
        return _coerce(_heuristic_extract(hit), hit)

    from openai import OpenAI

    client = OpenAI(api_key=api_key)
    chosen = model or os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    response = client.chat.completions.create(
        model=chosen,
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": EXTRACT_SYSTEM},
            {
                "role": "user",
                "content": build_extract_user_prompt(
                    title=hit.title, url=hit.url, text=text
                ),
            },
        ],
    )
    content = response.choices[0].message.content or "{}"
    data = _parse_json_payload(content)
    return _coerce(data, hit)


def from_fixture_expected(path_data: dict[str, Any]) -> ExtractedLead:
    """Build an ExtractedLead from a fixture's expected block (seed path)."""
    expected = path_data["expected"]
    excerpt = path_data["raw_text"]
    url = path_data["original_post_url"]
    ch = content_hash(
        url=url,
        location=expected.get("location"),
        contact=expected.get("contact"),
        excerpt=excerpt,
    )
    return ExtractedLead(
        location=expected["location"],
        opportunity_type=expected["opportunity_type"],
        land_size=expected.get("land_size"),
        asking_price=expected.get("asking_price"),
        planning_status=expected["planning_status"],
        landowner_name=expected.get("landowner_name"),
        contact=expected.get("contact"),
        ownership_confidence=expected["ownership_confidence"],
        seller_motivation=expected.get("seller_motivation"),
        ai_assessment=expected["ai_assessment"],
        ai_rationale=f"Fixture expected: {path_data.get('title', '')}",
        source=path_data.get("source", "fixture"),
        original_post_url=url,
        raw_excerpt=excerpt,
        content_hash=ch,
        date_discovered=path_data.get("posted_at"),
    )
