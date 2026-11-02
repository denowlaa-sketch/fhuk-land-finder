from __future__ import annotations

import hashlib
import re


def normalise_text(text: str) -> str:
    collapsed = re.sub(r"\s+", " ", text.strip().lower())
    return collapsed


def content_hash(
    *,
    url: str | None,
    location: str | None,
    contact: str | None,
    excerpt: str | None,
) -> str:
    """Stable hash for dedupe: URL preferred, else location+contact+excerpt."""
    if url:
        key = f"url:{url.strip().lower()}"
    else:
        key = "|".join(
            [
                f"loc:{normalise_text(location or '')}",
                f"contact:{normalise_text(contact or '')}",
                f"ex:{normalise_text((excerpt or '')[:500])}",
            ]
        )
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def is_duplicate(existing_hashes: set[str], new_hash: str) -> bool:
    return new_hash in existing_hashes
