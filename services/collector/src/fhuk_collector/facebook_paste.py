"""
Facebook URL / pasted-text analysis — compliant path only.

User supplies a public Facebook post URL and/or the post text they copied.
We never fetch Facebook, never call the Graph API, and never scrape groups.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import asdict
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from .extract import _coerce, _heuristic_extract, _parse_json_payload
from .models import ExtractedLead, SearchHit
from .prompts import FACEBOOK_PASTE_SYSTEM, build_facebook_paste_prompt

FACEBOOK_HOSTS = {
    "facebook.com",
    "www.facebook.com",
    "m.facebook.com",
    "web.facebook.com",
    "fb.com",
    "www.fb.com",
    "fb.watch",
}


def is_facebook_url(url: str) -> bool:
    if not url or not url.strip():
        return False
    try:
        parsed = urlparse(url.strip())
    except ValueError:
        return False
    host = (parsed.netloc or "").lower()
    return any(
        host == h or host.endswith("." + h.replace("www.", ""))
        for h in ("facebook.com", "fb.com", "fb.watch")
    ) or host in FACEBOOK_HOSTS


def normalize_facebook_url(url: str | None) -> str | None:
    if not url or not url.strip():
        return None
    return url.strip()


def analyze_paste(
    *,
    text: str,
    url: str | None = None,
    title: str | None = None,
) -> ExtractedLead:
    """
    Extract land fields from user-pasted Facebook post text.

    Requires non-empty text — we do not fetch the URL.
    Contacts are taken only if present in the pasted text.
    Ownership / sale intent stay conservative when unclear.
    """
    body = (text or "").strip()
    if not body:
        raise ValueError(
            "Paste the public post text to analyse. "
            "This tool does not fetch or scrape Facebook URLs."
        )

    cleaned_url = normalize_facebook_url(url)
    if cleaned_url and not is_facebook_url(cleaned_url):
        # Still allow analysis of pasted text with a non-FB link labelled manual.
        source = "manual_paste"
    else:
        source = "facebook_paste"

    hit = SearchHit(
        title=title or "Facebook paste analysis",
        url=cleaned_url or "",
        snippet=body[:400],
        source=source,
        query="facebook_paste",
        raw_text=body,
    )

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        lead = _coerce(_heuristic_extract(hit), hit)
    else:
        from openai import OpenAI

        client = OpenAI(api_key=api_key)
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        response = client.chat.completions.create(
            model=model,
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": FACEBOOK_PASTE_SYSTEM},
                {
                    "role": "user",
                    "content": build_facebook_paste_prompt(
                        url=cleaned_url, text=body
                    ),
                },
            ],
        )
        content = response.choices[0].message.content or "{}"
        data = _parse_json_payload(content)
        lead = _coerce(data, hit)

    note = "Facebook paste — URL not fetched; ownership/sale intent not assumed from the link alone."
    if lead.ai_rationale:
        if "not fetched" not in lead.ai_rationale.lower():
            lead.ai_rationale = f"{lead.ai_rationale} ({note})"
    else:
        lead.ai_rationale = note
    return lead


def analyze_fixture_file(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    lead = analyze_paste(
        text=data["raw_text"],
        url=data.get("original_post_url"),
        title=data.get("title"),
    )
    expected = data.get("expected") or {}
    return {
        "fixture": path.name,
        "lead": asdict(lead),
        "expected": expected,
        "assessment_match": (
            lead.ai_assessment == expected.get("ai_assessment")
            if expected.get("ai_assessment")
            else None
        ),
    }


def looks_like_contact_in_text(text: str) -> bool:
    if re.search(r"\b[\w.+-]+@[\w.-]+\.\w+\b", text):
        return True
    if re.search(r"\b(?:0|\+44)\d[\d\s-]{8,}\b", text):
        return True
    return False
