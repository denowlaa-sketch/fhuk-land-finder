EXTRACT_SYSTEM = """You are a land-sourcing analyst for Flipping Homes UK.
Extract structured fields from a publicly posted UK land opportunity.
Only use information present in the text. Do not invent phone numbers or emails.
If ownership or sale intent is unclear, lower ownership_confidence and prefer Investigate.
Reject agent-only listings, non-UK locations, spam, or posts with no land signal.
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
