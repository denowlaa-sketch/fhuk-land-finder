from pathlib import Path

from fhuk_collector.connectors.auctions import (
    AuctionsSearchConnector,
    looks_like_residential_noise,
)
from fhuk_collector.connectors.factory import resolve_connector
from fhuk_collector.keywords import AUCTIONS_EXTRA_PHRASES, expand_auctions_queries
from fhuk_collector.pipeline import run_pipeline

SAMPLES = Path(__file__).resolve().parents[1] / "samples" / "search"


def test_auctions_phrases():
    assert "building plot auction" in AUCTIONS_EXTRA_PHRASES
    assert "development land lot" in AUCTIONS_EXTRA_PHRASES
    queries = expand_auctions_queries()
    assert any("Bolton" in q for q in queries)
    assert any("Greater Manchester" in q for q in queries)
    assert any("auction" in q.lower() or "plot" in q.lower() for q in queries)


def test_residential_noise_filter():
    assert looks_like_residential_noise(
        "Lot 4 — 3 bed semi-detached investment, tenanted buy-to-let"
    )
    assert not looks_like_residential_noise(
        "Lot 12 — Building plot with outline planning, Bolton BL1 guide price"
    )
    assert not looks_like_residential_noise(
        "3 bed design proposed on building plot with planning permission"
    )


def test_auctions_recorded_filters_residential_noise():
    c = AuctionsSearchConnector(recorded_path=SAMPLES / "auctions_gm.json")
    hits = c.search("building plot Greater Manchester", num=12)
    assert hits
    urls = {h.url for h in hits}
    assert "https://example.invalid/auctionhouse/gm/lot-4-manchester-semi" not in urls
    assert "https://example.invalid/plotfinder/gm/noise-manchester-flat" not in urls
    assert any(h.source.startswith("auctions:auctionhouse") for h in hits)
    assert any(
        "plotfinder" in h.source or "plotbrowser" in h.source for h in hits
    )
    assert any("sdl" in h.source or "eg" in h.source for h in hits)


def test_per_site_providers():
    ah = resolve_connector(
        "auctionhouse", recorded_path=SAMPLES / "auctions_gm.json"
    )
    hits = ah.search("Bolton building plot", num=5)
    assert hits
    assert all("auctionhouse" in h.source for h in hits)

    pf = resolve_connector(
        "plotfinder", recorded_path=SAMPLES / "auctions_gm.json"
    )
    pf_hits = pf.search("Rochdale self build", num=5)
    assert pf_hits
    assert all("plotfinder" in h.source for h in pf_hits)


def test_auctions_pipeline_dry_run():
    c = resolve_connector("auctions", recorded_path=SAMPLES / "auctions_gm.json")
    summary = run_pipeline(
        c,
        dry_run=True,
        limit_queries=6,
        results_per_query=5,
        queries=expand_auctions_queries()[:6],
    )
    assert summary.provider == "auctions"
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
            assert r.lead.source.startswith("auctions:")
