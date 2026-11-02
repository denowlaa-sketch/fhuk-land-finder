from pathlib import Path

from fhuk_collector.connectors.classifieds import (
    ClassifiedsSearchConnector,
    looks_like_agent_spam,
)
from fhuk_collector.connectors.factory import resolve_connector
from fhuk_collector.keywords import CLASSIFIEDS_EXTRA_PHRASES, expand_classifieds_queries
from fhuk_collector.pipeline import run_pipeline

SAMPLES = Path(__file__).resolve().parents[1] / "samples" / "search"


def test_classifieds_phrases():
    assert "no agents land" in CLASSIFIEDS_EXTRA_PHRASES
    queries = expand_classifieds_queries()
    assert any("Bolton" in q for q in queries)
    assert any("Greater Manchester" in q for q in queries)


def test_agent_spam_filter():
    assert looks_like_agent_spam(
        "Call our office — estate agents — also on Rightmove"
    )
    assert not looks_like_agent_spam(
        "Private sale rear garden plot — no agents — landowner selling"
    )


def test_classifieds_recorded_filters_agent_spam():
    c = ClassifiedsSearchConnector(recorded_path=SAMPLES / "classifieds_gm.json")
    hits = c.search("land for sale Greater Manchester", num=10)
    assert hits
    urls = {h.url for h in hits}
    assert "https://example.invalid/gumtree/gm/agent-spam-manchester" not in urls
    assert any(h.source.startswith("classifieds:gumtree") for h in hits)
    assert any("preloved" in h.source or "freeads" in h.source for h in hits)


def test_per_site_providers():
    gum = resolve_connector(
        "gumtree", recorded_path=SAMPLES / "classifieds_gm.json"
    )
    hits = gum.search("Bolton garden", num=5)
    assert hits
    assert all("gumtree" in h.source for h in hits)


def test_classifieds_pipeline_dry_run():
    c = resolve_connector(
        "classifieds", recorded_path=SAMPLES / "classifieds_gm.json"
    )
    summary = run_pipeline(
        c,
        dry_run=True,
        limit_queries=6,
        results_per_query=5,
        queries=expand_classifieds_queries()[:6],
    )
    assert summary.provider == "classifieds"
    assert summary.hit_count >= 1
    assert any(r.status == "dry_run" and r.lead for r in summary.results)
    for r in summary.results:
        if r.lead:
            assert r.lead.ownership_confidence in {
                "confirmed",
                "likely",
                "possible",
                "unknown",
            }
