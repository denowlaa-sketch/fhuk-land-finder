from pathlib import Path

from fhuk_collector.connectors.factory import resolve_connector
from fhuk_collector.connectors.forums import ForumSearchConnector
from fhuk_collector.connectors.reddit import RedditSearchConnector
from fhuk_collector.keywords import REDDIT_EXTRA_PHRASES, expand_reddit_queries
from fhuk_collector.pipeline import run_pipeline

SAMPLES = Path(__file__).resolve().parents[1] / "samples" / "search"


def test_reddit_extra_phrases_aligned():
    assert "inherited land" in REDDIT_EXTRA_PHRASES
    assert "no planning" in REDDIT_EXTRA_PHRASES
    queries = expand_reddit_queries()
    assert any("Bolton" in q and "garden" in q.lower() for q in queries)
    assert any("Greater Manchester" in q for q in queries)


def test_reddit_recorded_without_keys(monkeypatch):
    monkeypatch.delenv("REDDIT_CLIENT_ID", raising=False)
    monkeypatch.delenv("REDDIT_CLIENT_SECRET", raising=False)
    c = resolve_connector("reddit", recorded_path=SAMPLES / "reddit_gm.json")
    assert isinstance(c, RedditSearchConnector)
    assert not c.live
    hits = c.search("inherited land Bolton", num=3)
    assert hits
    assert any("Bolton" in (h.raw_text or "") or "Bolton" in h.title for h in hits)
    assert all(h.url.startswith("https://www.reddit.com/") for h in hits)


def test_reddit_pipeline_dry_run(monkeypatch):
    monkeypatch.delenv("REDDIT_CLIENT_ID", raising=False)
    monkeypatch.delenv("REDDIT_CLIENT_SECRET", raising=False)
    c = RedditSearchConnector(recorded_path=SAMPLES / "reddit_gm.json")
    summary = run_pipeline(
        c,
        dry_run=True,
        limit_queries=6,
        results_per_query=5,
        queries=expand_reddit_queries()[:6],
    )
    assert summary.provider == "reddit"
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


def test_forums_recorded_pipeline():
    c = ForumSearchConnector(recorded_path=SAMPLES / "uk_forums_gm.json")
    hits = c.search("inherited land Oldham", num=3)
    assert hits
    assert hits[0].source.startswith("forum:")
    summary = run_pipeline(
        c,
        dry_run=True,
        limit_queries=4,
        queries=expand_reddit_queries()[:4],
    )
    assert summary.provider == "forums"
    assert summary.hit_count >= 1
