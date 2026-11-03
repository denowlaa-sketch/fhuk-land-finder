from __future__ import annotations

import json
import os
from typing import Any

from .models import ExtractedLead, SearchHit

try:
    import psycopg
except ImportError:  # pragma: no cover
    psycopg = None  # type: ignore


def database_url() -> str | None:
    return os.getenv("DATABASE_URL")


def connect():
    url = database_url()
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    if psycopg is None:
        raise RuntimeError("psycopg is not installed")
    return psycopg.connect(url)


def _infer_source_kind(source: str) -> str:
    s = (source or "").lower()
    if "reddit" in s:
        return "REDDIT"
    if "forum" in s:
        return "FORUM"
    if any(x in s for x in ("gumtree", "preloved", "freeads", "classified")):
        return "CLASSIFIED"
    if any(x in s for x in ("auction", "plotfinder", "plotbrowser")):
        return "AUCTION"
    if "facebook" in s or s.startswith("fb"):
        return "FACEBOOK_URL"
    if "fixture" in s:
        return "FIXTURE"
    if any(x in s for x in ("google", "bing", "search", "recorded")):
        return "SEARCH"
    if "manual" in s or "paste" in s:
        return "MANUAL"
    return "OTHER"


def fetch_existing_hashes(conn) -> set[str]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT content_hash FROM leads WHERE content_hash IS NOT NULL"
        )
        hashes = {row[0] for row in cur.fetchall()}
        try:
            cur.execute(
                "SELECT content_hash FROM discovery_prospects "
                "WHERE content_hash IS NOT NULL"
            )
            hashes |= {row[0] for row in cur.fetchall()}
        except Exception:
            conn.rollback()
        return hashes


def fetch_existing_urls(conn) -> set[str]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT original_post_url FROM leads WHERE original_post_url IS NOT NULL"
        )
        urls = {row[0] for row in cur.fetchall()}
        try:
            cur.execute(
                "SELECT source_url FROM discovery_prospects "
                "WHERE source_url IS NOT NULL"
            )
            urls |= {row[0] for row in cur.fetchall()}
        except Exception:
            conn.rollback()
        return urls


def upsert_discovery_prospect(
    conn,
    hit: SearchHit,
    lead: ExtractedLead | None = None,
) -> dict[str, Any]:
    """Write / update a Discovery inbox row (Solar-style pending import)."""
    title = hit.title or (lead.location if lead else "Untitled prospect")
    source_kind = _infer_source_kind(hit.source or (lead.source if lead else ""))
    payload: dict[str, Any] = {}
    preview_score = None
    preview_assessment = None
    location = None
    content_hash = None
    raw_text = hit.raw_text or hit.snippet

    if lead:
        payload = {
            "location": lead.location,
            "opportunity_type": lead.opportunity_type,
            "land_size": lead.land_size,
            "asking_price": lead.asking_price,
            "planning_status": lead.planning_status,
            "landowner_name": lead.landowner_name,
            "contact": lead.contact,
            "ownership_confidence": lead.ownership_confidence,
            "seller_motivation": lead.seller_motivation,
            "ai_rationale": lead.ai_rationale,
        }
        location = lead.location
        content_hash = lead.content_hash
        preview_assessment = lead.ai_assessment
        raw_text = lead.raw_excerpt or raw_text
        # Simple preview score aligned with Strong/Investigate/Reject.
        preview_score = {"Strong": 85, "Investigate": 55, "Reject": 20}.get(
            lead.ai_assessment, 40
        )

    with conn.cursor() as cur:
        if hit.url:
            cur.execute(
                """
                UPDATE discovery_prospects SET
                  title = %s,
                  location = %s,
                  source = %s,
                  source_kind = %s::lead_source,
                  snippet = %s,
                  raw_text = %s,
                  query = %s,
                  content_hash = COALESCE(%s, content_hash),
                  preview_score = %s,
                  preview_assessment = %s::ai_assessment,
                  payload = %s::jsonb
                WHERE source_url = %s AND imported_at IS NULL
                RETURNING id
                """,
                (
                    title,
                    location,
                    hit.source,
                    source_kind,
                    hit.snippet,
                    raw_text,
                    hit.query,
                    content_hash,
                    preview_score,
                    preview_assessment,
                    json.dumps(payload),
                    hit.url,
                ),
            )
            row = cur.fetchone()
            if row:
                conn.commit()
                return {"id": str(row[0]), "created": False}

        cur.execute(
            """
            INSERT INTO discovery_prospects (
              title, location, source, source_kind, source_url,
              snippet, raw_text, query, content_hash, preview_score,
              preview_assessment, payload
            ) VALUES (
              %s, %s, %s, %s::lead_source, %s,
              %s, %s, %s, %s, %s,
              %s::ai_assessment, %s::jsonb
            )
            RETURNING id
            """,
            (
                title,
                location,
                hit.source,
                source_kind,
                hit.url or None,
                hit.snippet,
                raw_text,
                hit.query,
                content_hash,
                preview_score,
                preview_assessment,
                json.dumps(payload),
            ),
        )
        row = cur.fetchone()
    conn.commit()
    return {"id": str(row[0]), "created": True}


def insert_lead(conn, lead: ExtractedLead) -> dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute("SELECT next_lead_ref()")
        ref = cur.fetchone()[0]
        cur.execute(
            """
            INSERT INTO leads (
              ref, location, opportunity_type, land_size, asking_price,
              planning_status, source, original_post_url, landowner_name,
              contact, ownership_confidence, seller_motivation,
              ai_assessment, ai_rationale, date_discovered, raw_excerpt,
              content_hash
            ) VALUES (
              %s, %s, %s::opportunity_type, %s, %s,
              %s::planning_status, %s, %s, %s,
              %s, %s::ownership_confidence, %s,
              %s::ai_assessment, %s,
              COALESCE(%s::timestamptz, NOW()), %s, %s
            )
            RETURNING id, ref
            """,
            (
                ref,
                lead.location,
                lead.opportunity_type,
                lead.land_size,
                lead.asking_price,
                lead.planning_status,
                lead.source,
                lead.original_post_url,
                lead.landowner_name,
                lead.contact,
                lead.ownership_confidence,
                lead.seller_motivation,
                lead.ai_assessment,
                lead.ai_rationale,
                lead.date_discovered,
                lead.raw_excerpt,
                lead.content_hash,
            ),
        )
        row = cur.fetchone()
    conn.commit()
    return {"id": str(row[0]), "ref": row[1], "created": True}


def upsert_lead_by_url(conn, lead: ExtractedLead) -> dict[str, Any]:
    """Update an existing lead with the same original_post_url, else insert."""
    if lead.original_post_url:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE leads SET
                  location = %s,
                  opportunity_type = %s::opportunity_type,
                  land_size = %s,
                  asking_price = %s,
                  planning_status = %s::planning_status,
                  source = %s,
                  landowner_name = %s,
                  contact = %s,
                  ownership_confidence = %s::ownership_confidence,
                  seller_motivation = %s,
                  ai_assessment = %s::ai_assessment,
                  ai_rationale = %s,
                  raw_excerpt = %s,
                  content_hash = %s
                WHERE original_post_url = %s
                RETURNING id, ref
                """,
                (
                    lead.location,
                    lead.opportunity_type,
                    lead.land_size,
                    lead.asking_price,
                    lead.planning_status,
                    lead.source,
                    lead.landowner_name,
                    lead.contact,
                    lead.ownership_confidence,
                    lead.seller_motivation,
                    lead.ai_assessment,
                    lead.ai_rationale,
                    lead.raw_excerpt,
                    lead.content_hash,
                    lead.original_post_url,
                ),
            )
            row = cur.fetchone()
        if row:
            conn.commit()
            return {"id": str(row[0]), "ref": row[1], "created": False}
    return insert_lead(conn, lead)
