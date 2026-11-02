from fhuk_collector.keywords import expand_queries, load_keywords


def test_greater_manchester_seed_expands():
    seed = load_keywords()
    assert seed["region"] == "Greater Manchester"
    assert "Bolton" in seed["towns"]
    assert "Wigan" in seed["towns"]
    queries = expand_queries(seed)
    assert len(queries) == len(seed["towns"]) * len(seed["phrases"])
    assert any("Bolton" in q and "back garden" in q.lower() for q in queries)
