from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal

OpportunityType = Literal[
    "backland",
    "garden_plot",
    "brownfield",
    "infill",
    "agricultural",
    "other",
]
PlanningStatus = Literal[
    "none", "pre_app", "outline", "full", "expired", "unknown"
]
OwnershipConfidence = Literal["confirmed", "likely", "possible", "unknown"]
AiAssessment = Literal["Strong", "Investigate", "Reject"]


@dataclass
class SearchHit:
    title: str
    url: str
    snippet: str
    source: str
    query: str
    raw_text: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class ExtractedLead:
    location: str
    opportunity_type: OpportunityType
    land_size: str | None
    asking_price: float | None
    planning_status: PlanningStatus
    landowner_name: str | None
    contact: str | None
    ownership_confidence: OwnershipConfidence
    seller_motivation: str | None
    ai_assessment: AiAssessment
    ai_rationale: str
    source: str
    original_post_url: str | None
    raw_excerpt: str
    content_hash: str
    date_discovered: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
