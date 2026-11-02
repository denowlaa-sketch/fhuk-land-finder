import json
import logging

import pytest

from fhuk_collector.notify import (
    LeadNotifyPayload,
    config_status,
    maybe_notify_lead,
    send_lead_email,
    should_notify,
)


def test_should_notify_only_new_strong_investigate(monkeypatch):
    monkeypatch.setenv("NOTIFY_EMAIL_ENABLED", "true")
    assert should_notify("Strong", created=True) is True
    assert should_notify("Investigate", created=True) is True
    assert should_notify("Reject", created=True) is False
    assert should_notify("Strong", created=False) is False
    monkeypatch.setenv("NOTIFY_EMAIL_ENABLED", "false")
    assert should_notify("Strong", created=True) is False


def test_dry_run_logs_without_sending(monkeypatch, capsys, caplog):
    monkeypatch.setenv("NOTIFY_EMAIL_ENABLED", "true")
    monkeypatch.setenv("NOTIFY_EMAIL_MODE", "dry-run")
    monkeypatch.setenv("NOTIFY_EMAIL_TO", "ops@example.com")
    monkeypatch.setenv("NOTIFY_EMAIL_FROM", "bot@example.com")
    monkeypatch.setenv("NOTIFY_EMAIL_PROVIDER", "smtp")

    payload = LeadNotifyPayload(
        ref="FHUK-0001",
        location="Bolton",
        opportunity_type="garden_plot",
        ai_assessment="Strong",
        source="facebook_paste",
        original_post_url="https://www.facebook.com/example",
        ai_rationale="Clear owner signal",
    )

    with caplog.at_level(logging.INFO):
        result = send_lead_email(payload)

    assert result["dry_run"] is True
    assert result["sent"] is False
    assert result["to"] == ["ops@example.com"]
    assert "FHUK-0001" in result["subject"]

    printed = capsys.readouterr().out
    logged = json.loads(printed.strip())
    assert logged["notify"]["dry_run"] is True
    assert logged["notify"]["payload"]["ref"] == "FHUK-0001"


def test_maybe_notify_skips_when_disabled(monkeypatch):
    monkeypatch.delenv("NOTIFY_EMAIL_ENABLED", raising=False)
    assert (
        maybe_notify_lead(
            ref="FHUK-0002",
            location="Oldham",
            opportunity_type="backland",
            ai_assessment="Strong",
            source="recorded",
            created=True,
        )
        is None
    )


def test_config_status(monkeypatch):
    monkeypatch.setenv("NOTIFY_EMAIL_ENABLED", "true")
    monkeypatch.setenv("NOTIFY_EMAIL_MODE", "dry-run")
    monkeypatch.setenv("NOTIFY_EMAIL_TO", "a@x.com, b@y.com")
    monkeypatch.setenv("NOTIFY_EMAIL_PROVIDER", "resend")
    status = config_status()
    assert status["enabled"] is True
    assert status["mode"] == "dry-run"
    assert status["provider"] == "resend"
    assert status["to"] == ["a@x.com", "b@y.com"]
    assert status["ready"] is True
    assert status["would_send"] is False


def test_send_mode_requires_provider_config(monkeypatch):
    monkeypatch.setenv("NOTIFY_EMAIL_ENABLED", "true")
    monkeypatch.setenv("NOTIFY_EMAIL_MODE", "send")
    monkeypatch.setenv("NOTIFY_EMAIL_TO", "ops@example.com")
    monkeypatch.setenv("NOTIFY_EMAIL_PROVIDER", "resend")
    monkeypatch.delenv("RESEND_API_KEY", raising=False)

    result = maybe_notify_lead(
        ref="FHUK-0003",
        location="Stockport",
        opportunity_type="infill",
        ai_assessment="Investigate",
        source="fixtures",
        created=True,
    )
    assert result is not None
    assert result.get("sent") is False
    assert "RESEND_API_KEY" in (result.get("error") or "")
