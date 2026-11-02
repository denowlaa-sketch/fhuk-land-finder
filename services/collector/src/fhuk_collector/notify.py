"""Optional email notifications for Strong / Investigate leads.

Supports SMTP, Resend, and SendGrid. Default mode is dry-run (log only).
"""

from __future__ import annotations

import json
import logging
import os
import smtplib
import ssl
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from email.message import EmailMessage
from typing import Any, Literal

logger = logging.getLogger(__name__)

NotifyableAssessment = Literal["Strong", "Investigate"]
NotifyMode = Literal["dry-run", "send"]
NotifyProvider = Literal["smtp", "resend", "sendgrid"]

NOTIFYABLE: set[str] = {"Strong", "Investigate"}


@dataclass
class LeadNotifyPayload:
    ref: str
    location: str
    opportunity_type: str
    ai_assessment: str
    source: str
    original_post_url: str | None = None
    ai_rationale: str | None = None

    def subject(self) -> str:
        return (
            f"[FHUK Land Finder] {self.ai_assessment} lead {self.ref} — {self.location}"
        )

    def body_text(self) -> str:
        lines = [
            "New land lead (Flipping Homes UK Land Finder)",
            "",
            f"Ref:         {self.ref}",
            f"Location:    {self.location}",
            f"Type:        {self.opportunity_type}",
            f"Assessment:  {self.ai_assessment}",
            f"Source:      {self.source}",
            f"Source link: {self.original_post_url or '(none)'}",
        ]
        if self.ai_rationale:
            lines.extend(["", "Rationale:", self.ai_rationale])
        return "\n".join(lines) + "\n"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _truthy(value: str | None, default: bool = False) -> bool:
    if value is None or value == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def notifications_enabled() -> bool:
    return _truthy(os.getenv("NOTIFY_EMAIL_ENABLED"), default=False)


def notify_mode() -> NotifyMode:
    raw = (os.getenv("NOTIFY_EMAIL_MODE") or "dry-run").strip().lower()
    if raw in {"send", "live"}:
        return "send"
    return "dry-run"


def notify_provider() -> NotifyProvider:
    raw = (os.getenv("NOTIFY_EMAIL_PROVIDER") or "smtp").strip().lower()
    if raw in {"resend", "sendgrid", "smtp"}:
        return raw  # type: ignore[return-value]
    return "smtp"


def notify_recipients() -> list[str]:
    raw = os.getenv("NOTIFY_EMAIL_TO") or ""
    return [part.strip() for part in raw.split(",") if part.strip()]


def notify_from() -> str:
    return (
        os.getenv("NOTIFY_EMAIL_FROM")
        or os.getenv("SMTP_FROM")
        or "land-finder@localhost"
    )


def should_notify(assessment: str, *, created: bool = True) -> bool:
    """Only new Strong/Investigate leads trigger email."""
    if not created:
        return False
    if assessment not in NOTIFYABLE:
        return False
    return notifications_enabled()


def config_status() -> dict[str, Any]:
    recipients = notify_recipients()
    mode = notify_mode()
    provider = notify_provider()
    enabled = notifications_enabled()
    ready = bool(recipients) and enabled
    return {
        "enabled": enabled,
        "mode": mode,
        "provider": provider,
        "to": recipients,
        "from": notify_from(),
        "ready": ready,
        "would_send": ready and mode == "send",
    }


def _send_smtp(payload: LeadNotifyPayload, recipients: list[str]) -> dict[str, Any]:
    host = os.getenv("SMTP_HOST")
    if not host:
        raise RuntimeError("SMTP_HOST is required for smtp provider")
    port = int(os.getenv("SMTP_PORT") or "587")
    user = os.getenv("SMTP_USER") or ""
    password = os.getenv("SMTP_PASSWORD") or ""
    use_tls = _truthy(os.getenv("SMTP_TLS"), default=True)

    msg = EmailMessage()
    msg["Subject"] = payload.subject()
    msg["From"] = notify_from()
    msg["To"] = ", ".join(recipients)
    msg.set_content(payload.body_text())

    if use_tls:
        context = ssl.create_default_context()
        with smtplib.SMTP(host, port, timeout=30) as smtp:
            smtp.starttls(context=context)
            if user:
                smtp.login(user, password)
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(host, port, timeout=30) as smtp:
            if user:
                smtp.login(user, password)
            smtp.send_message(msg)

    return {"provider": "smtp", "sent": True, "to": recipients}


def _post_json(url: str, headers: dict[str, str], body: dict[str, Any]) -> dict[str, Any]:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={**headers, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {"ok": True}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code}: {detail}") from exc


def _send_resend(payload: LeadNotifyPayload, recipients: list[str]) -> dict[str, Any]:
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        raise RuntimeError("RESEND_API_KEY is required for resend provider")
    result = _post_json(
        "https://api.resend.com/emails",
        {"Authorization": f"Bearer {api_key}"},
        {
            "from": notify_from(),
            "to": recipients,
            "subject": payload.subject(),
            "text": payload.body_text(),
        },
    )
    return {"provider": "resend", "sent": True, "to": recipients, "response": result}


def _send_sendgrid(payload: LeadNotifyPayload, recipients: list[str]) -> dict[str, Any]:
    api_key = os.getenv("SENDGRID_API_KEY")
    if not api_key:
        raise RuntimeError("SENDGRID_API_KEY is required for sendgrid provider")
    result = _post_json(
        "https://api.sendgrid.com/v3/mail/send",
        {"Authorization": f"Bearer {api_key}"},
        {
            "personalizations": [{"to": [{"email": addr} for addr in recipients]}],
            "from": {"email": notify_from()},
            "subject": payload.subject(),
            "content": [{"type": "text/plain", "value": payload.body_text()}],
        },
    )
    return {"provider": "sendgrid", "sent": True, "to": recipients, "response": result}


def send_lead_email(payload: LeadNotifyPayload) -> dict[str, Any]:
    """Send or dry-run log a lead notification email."""
    recipients = notify_recipients()
    if not recipients:
        return {
            "skipped": True,
            "reason": "NOTIFY_EMAIL_TO is empty",
            "payload": payload.to_dict(),
        }

    mode = notify_mode()
    provider = notify_provider()
    record = {
        "mode": mode,
        "provider": provider,
        "to": recipients,
        "from": notify_from(),
        "subject": payload.subject(),
        "payload": payload.to_dict(),
    }

    if mode == "dry-run":
        logger.info(
            "NOTIFY dry-run (not sent): %s",
            json.dumps(record, default=str),
        )
        print(
            json.dumps({"notify": {**record, "sent": False, "dry_run": True}}, default=str),
            flush=True,
        )
        return {**record, "sent": False, "dry_run": True}

    if provider == "resend":
        result = _send_resend(payload, recipients)
    elif provider == "sendgrid":
        result = _send_sendgrid(payload, recipients)
    else:
        result = _send_smtp(payload, recipients)

    logger.info("NOTIFY sent via %s to %s for %s", provider, recipients, payload.ref)
    return {**record, **result, "dry_run": False}


def maybe_notify_lead(
    *,
    ref: str,
    location: str,
    opportunity_type: str,
    ai_assessment: str,
    source: str,
    original_post_url: str | None = None,
    ai_rationale: str | None = None,
    created: bool = True,
) -> dict[str, Any] | None:
    """Notify when enabled and assessment is Strong/Investigate for a new lead."""
    if not should_notify(ai_assessment, created=created):
        return None
    payload = LeadNotifyPayload(
        ref=ref,
        location=location,
        opportunity_type=opportunity_type,
        ai_assessment=ai_assessment,
        source=source,
        original_post_url=original_post_url,
        ai_rationale=ai_rationale,
    )
    try:
        return send_lead_email(payload)
    except Exception as exc:  # noqa: BLE001 — never fail the write path
        logger.exception("Lead email notification failed for %s", ref)
        print(
            json.dumps(
                {
                    "notify": {
                        "error": str(exc),
                        "ref": ref,
                        "sent": False,
                    }
                }
            ),
            flush=True,
        )
        return {"error": str(exc), "ref": ref, "sent": False}
