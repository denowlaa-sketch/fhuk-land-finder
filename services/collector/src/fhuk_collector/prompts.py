EXTRACT_SYSTEM = """You are a land-sourcing analyst for Flipping Homes UK.
Extract structured fields from a publicly posted UK land opportunity.
Only use information present in the text. Do not invent phone numbers or emails.
Never invent contacts — only copy voluntarily published phone/email from the text.
If ownership or sale intent is unclear, lower ownership_confidence and prefer Investigate.
Do not assume the poster is the landowner or that the plot is for sale.
Reject agent-only listings, non-UK locations, spam, or posts with no land signal.
Respond with a single JSON object only (no markdown)."""

FACEBOOK_PASTE_SYSTEM = """You are a land-sourcing analyst for Flipping Homes UK.
The user pasted a public Facebook post URL and/or the post text. The URL was NOT fetched or scraped.
Extract structured fields only from the pasted text.
Rules:
- Do not invent phone numbers, emails, names, prices, or locations.
- Contacts only if voluntarily published in the pasted text.
- Do not assume ownership or sale intent from a Facebook URL alone.
- Rumour / second-hand tips → ownership_confidence possible|unknown and ai_assessment Investigate.
- Clear private landowner sale language with usable UK location → Strong is allowed with likely/confirmed ownership only when the text supports it.
- Estate agent / marketplace agent ads → Reject.
Respond with a single JSON object only (no markdown)."""

EXTRACT_SCHEMA_HINT = """
JSON keys:
- location (string)
- opportunity_type: backland|garden_plot|brownfield|infill|agricultural|other
- land_size (string|null)
- asking_price (number|null, GBP)
- planning_status: none|pre_app|outline|full|expired|unknown
- landowner_name (string|null)
- contact (string|null)
- ownership_confidence: confirmed|likely|possible|unknown
- seller_motivation (string|null)
- ai_assessment: Strong|Investigate|Reject
- ai_rationale (string, short)
"""


def build_extract_user_prompt(*, title: str, url: str, text: str) -> str:
    return (
        f"Title: {title}\nURL: {url}\n\nPost text:\n{text}\n\n"
        f"Return JSON matching:{EXTRACT_SCHEMA_HINT}"
    )


def build_facebook_paste_prompt(*, url: str | None, text: str) -> str:
    return (
        "Source: user Facebook paste (no scrape).\n"
        f"URL (metadata only, not fetched): {url or '(none)'}\n\n"
        f"Pasted post text:\n{text}\n\n"
        f"Return JSON matching:{EXTRACT_SCHEMA_HINT}"
    )
