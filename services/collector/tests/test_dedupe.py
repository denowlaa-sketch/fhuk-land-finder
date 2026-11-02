from fhuk_collector.dedupe import content_hash, is_duplicate


def test_same_url_same_hash():
    a = content_hash(url="https://Example.invalid/a", location=None, contact=None, excerpt=None)
    b = content_hash(url="https://example.invalid/a", location="x", contact="y", excerpt="z")
    assert a == b


def test_duplicate_set():
    h = content_hash(url=None, location="Bolton", contact="07", excerpt="rear garden")
    assert is_duplicate({h}, h)
    assert not is_duplicate(set(), h)
