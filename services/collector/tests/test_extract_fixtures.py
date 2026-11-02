import json
from pathlib import Path

from fhuk_collector.extract import from_fixture_expected
from fhuk_collector.search import load_fixture_hits


FIXTURES = Path(__file__).resolve().parents[3] / "fixtures"  # repo root


def test_five_fixtures_present():
    files = sorted(FIXTURES.glob("*.json"))
    assert len(files) == 5
    towns = {json.loads(p.read_text())["town"] for p in files}
    assert {"Bolton", "Oldham", "Stockport", "Wigan", "Trafford"} <= towns


def test_fixture_expected_assessments():
    leads = [from_fixture_expected(json.loads(p.read_text())) for p in sorted(FIXTURES.glob("*.json"))]
    assessments = {lead.location.split(",")[0].strip(): lead.ai_assessment for lead in leads}
    assert assessments["Bolton"] == "Strong"
    assert assessments["Oldham"] == "Strong"
    assert assessments["Stockport"] == "Investigate"
    assert assessments["Wigan"] == "Reject"
    assert any(l.ai_assessment == "Strong" and "Sale" in l.location for l in leads)


def test_load_fixture_hits():
    hits = load_fixture_hits(FIXTURES)
    assert len(hits) == 5
    assert all(h.raw_text for h in hits)
