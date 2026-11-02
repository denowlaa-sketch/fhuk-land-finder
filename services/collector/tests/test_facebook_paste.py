import json
from pathlib import Path

from fhuk_collector.facebook_paste import (
    analyze_paste,
    is_facebook_url,
    looks_like_contact_in_text,
)

FIXTURES = Path(__file__).resolve().parents[3] / "fixtures" / "facebook"


def test_is_facebook_url():
    assert is_facebook_url("https://www.facebook.com/groups/x/posts/1")
    assert is_facebook_url("https://m.facebook.com/story.php?story_fbid=1")
    assert not is_facebook_url("https://example.com/post")


def test_requires_pasted_text():
    try:
        analyze_paste(text="", url="https://www.facebook.com/posts/1")
        assert False, "expected ValueError"
    except ValueError as exc:
        assert "does not fetch" in str(exc).lower() or "paste" in str(exc).lower()


def test_facebook_fixtures_assessments():
    results = []
    for path in sorted(FIXTURES.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        lead = analyze_paste(
            text=data["raw_text"],
            url=data.get("original_post_url"),
            title=data.get("title"),
        )
        expected = data["expected"]
        assert lead.ai_assessment == expected["ai_assessment"], path.name
        assert lead.ownership_confidence == expected["ownership_confidence"], path.name
        assert lead.source == "facebook_paste"
        # Never invent contacts not in text
        if expected.get("contact") is None:
            assert lead.contact is None or looks_like_contact_in_text(data["raw_text"])
        results.append(lead.ai_assessment)
    assert results == ["Strong", "Investigate", "Reject"]


def test_rumour_does_not_assume_ownership():
    lead = analyze_paste(
        text=(
            "Someone on my street in Stockport said their neighbour might sell "
            "a bit of garden. No number."
        ),
        url="https://www.facebook.com/groups/example.invalid/posts/99",
    )
    assert lead.ai_assessment == "Investigate"
    assert lead.ownership_confidence in {"possible", "unknown"}
    assert lead.contact is None
