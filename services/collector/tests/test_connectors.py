import json
from pathlib import Path

from fhuk_collector.connectors.factory import resolve_connector
from fhuk_collector.connectors.recorded import RecordedSearchConnector
from fhuk_collector.pipeline import run_pipeline

ROOT = Path(__file__).resolve().parents[3]
SAMPLE = (
    Path(__file__).resolve().parents[1]
    / "samples"
    / "search"
    / "google_cse_gm.json"
)


def test_recorded_sample_shape():
    data = json.loads(SAMPLE.read_text())
    assert len(data["items"]) == 5
    assert all("link" in i and "snippet" in i for i in data["items"])


def test_recorded_connector_returns_hits():
    c = RecordedSearchConnector(SAMPLE)
    hits = c.search("selling land Bolton", num=3)
    assert hits
    assert any("Bolton" in h.title or "Bolton" in (h.raw_text or "") for h in hits)
    assert all(h.source == "recorded_search" for h in hits)


def test_auto_falls_back_to_recorded(monkeypatch):
    monkeypatch.delenv("GOOGLE_CSE_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_CSE_CX", raising=False)
    monkeypatch.delenv("BING_SEARCH_API_KEY", raising=False)
    c = resolve_connector("auto", recorded_path=SAMPLE)
    assert c.name == "recorded"


def test_pipeline_recorded_dry_run():
    c = RecordedSearchConnector(SAMPLE)
    summary = run_pipeline(
        c,
        dry_run=True,
        limit_queries=5,
        results_per_query=5,
    )
    assert summary.provider == "recorded"
    assert summary.hit_count >= 1
    assert summary.region == "Greater Manchester"
    assert any(r.status == "dry_run" for r in summary.results)
    # Ownership confidence must be one of the honest enum values
    for r in summary.results:
        if r.lead:
            assert r.lead.ownership_confidence in {
                "confirmed",
                "likely",
                "possible",
                "unknown",
            }


def test_fixtures_provider_pipeline():
    c = resolve_connector("fixtures", fixtures_dir=ROOT / "fixtures")
    summary = run_pipeline(
        c,
        dry_run=True,
        limit_queries=0,
        use_all_fixtures=True,
        fixtures_dir=ROOT / "fixtures",
    )
    assert summary.hit_count == 5
    assert len(summary.results) == 5
