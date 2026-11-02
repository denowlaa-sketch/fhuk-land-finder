from __future__ import annotations

import os
from typing import Any

from .models import ExtractedLead

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


def fetch_existing_hashes(conn) -> set[str]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT content_hash FROM leads WHERE content_hash IS NOT NULL"
        )
        return {row[0] for row in cur.fetchall()}


def fetch_existing_urls(conn) -> set[str]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT original_post_url FROM leads WHERE original_post_url IS NOT NULL"
        )
        return {row[0] for row in cur.fetchall()}


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
    return {"id": str(row[0]), "ref": row[1]}
