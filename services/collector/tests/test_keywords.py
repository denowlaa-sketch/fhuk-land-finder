from fhuk_collector.keywords import (
    DEFAULT_REGION_SLUGS,
    expand_classifieds_queries,
    expand_queries,
    list_region_seeds,
    load_keywords,
    resolve_region_slugs,
)


def test_greater_manchester_seed_expands():
    seed = load_keywords(region="greater-manchester")
    assert seed["region"] == "Greater Manchester"
    assert "Bolton" in seed["towns"]
    assert "Wigan" in seed["towns"]
    assert "priority_towns" in seed
    queries = expand_queries(seed)
    assert len(queries) == len(seed["towns"]) * len(seed["phrases"])
    assert any("Bolton" in q and "back garden" in q.lower() for q in queries)


def test_all_regions_default(monkeypatch):
    monkeypatch.delenv("COLLECTOR_REGION", raising=False)
    slugs = resolve_region_slugs()
    assert slugs == list(DEFAULT_REGION_SLUGS)
    seeds = list_region_seeds()
    assert len(seeds) == len(DEFAULT_REGION_SLUGS)
    regions = {s["region"] for s in seeds}
    assert "West Yorkshire" in regions
    assert "Merseyside" in regions
    assert "Lancashire" in regions
    assert "Cheshire" in regions
    assert "West Midlands" in regions
    assert "Greater Manchester" in regions


def test_expand_queries_covers_new_towns(monkeypatch):
    monkeypatch.setenv("COLLECTOR_REGION", "all")
    queries = expand_queries()
    assert any("Leeds" in q for q in queries)
    assert any("Liverpool" in q for q in queries)
    assert any("Birmingham" in q for q in queries)
    assert any("Chester" in q for q in queries)
    assert any("Preston" in q for q in queries)
    assert any("Bolton" in q for q in queries)


def test_region_filter_west_yorkshire(monkeypatch):
    monkeypatch.setenv("COLLECTOR_REGION", "west-yorkshire")
    seed = load_keywords()
    assert seed["region"] == "West Yorkshire"
    queries = expand_queries()
    assert any("Huddersfield" in q for q in queries)
    assert not any("Bolton" in q for q in queries)


def test_classifieds_multi_region(monkeypatch):
    monkeypatch.setenv("COLLECTOR_REGION", "all")
    queries = expand_classifieds_queries()
    assert any("Greater Manchester" in q for q in queries)
    assert any("West Midlands" in q for q in queries)
    assert any("Leeds" in q for q in queries)
