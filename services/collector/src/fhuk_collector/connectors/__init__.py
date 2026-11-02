"""Pluggable public-web search connectors for FHUK Land Finder."""

from .base import SearchConnector
from .factory import available_providers, resolve_connector

__all__ = [
    "SearchConnector",
    "available_providers",
    "resolve_connector",
]
