"""Outbound email.

Render (and most PaaS providers) block outbound SMTP ports 25/465/587 at the
network level, so smtplib fails there with "[Errno 101] Network is unreachable"
no matter how correct the SMTP credentials are. The only reliable way to send
mail from such a host is an HTTPS email API.

So this module tries, in order:

  1. An HTTPS provider API (Brevo, Resend or SendGrid), if an API key is configured.
  2. Plain SMTP, for local development or hosts that allow SMTP egress.

Every send returns (ok, detail) instead of raising, and the SMTP path runs in a
worker thread so it never blocks the asyncio event loop.
"""

import asyncio
import smtplib
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

from app.core.config import settings

BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email"
# Last send attempt, so the console can report something true instead of a
# hardcoded line. In-process only: it resets when the instance restarts, which
# is why the UI distinguishes "nothing sent yet" from "last send failed".
_last_delivery: dict | None = None

RESEND_ENDPOINT = "https://api.resend.com/emails"
SENDGRID_ENDPOINT = "https://api.sendgrid.com/v3/mail/send"

# Ports a PaaS is likely to block outright.
BLOCKED_SMTP_HINT = (
    "This host blocks outbound SMTP (Render free instances block ports "
    "25/465/587). Set BREVO_API_KEY (or RESEND_API_KEY / SENDGRID_API_KEY) "
    "plus MAIL_FROM so mail is sent over HTTPS instead."
)


def _from_address(platform_settings=None) -> str:
    """Preferred sender: platform settings, then MAIL_FROM, then a safe default."""
    candidates = [
        getattr(platform_settings, "from_email", None),
        settings.MAIL_FROM,
    ]
    for value in candidates:
        if value and "example.com" not in value:
            return value
    return "onboarding@resend.dev"


async def _send_via_brevo(to_email: str, subject: str, html: str, from_email: str):
    payload = {
        "sender": {"email": from_email, "name": "CodeAgent OS"},
        "to": [{"email": to_email}],
        "subject": subject,
        "htmlContent": html,
    }
    headers = {"api-key": settings.BREVO_API_KEY, "accept": "application/json"}
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(BREVO_ENDPOINT, json=payload, headers=headers)
    if resp.status_code < 300:
        return True, "sent via brevo"
    return False, f"brevo returned {resp.status_code}: {resp.text[:300]}"


async def _send_via_resend(to_email: str, subject: str, html: str, from_email: str):
    payload = {"from": from_email, "to": [to_email], "subject": subject, "html": html}
    headers = {"Authorization": f"Bearer {settings.RESEND_API_KEY}"}
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(RESEND_ENDPOINT, json=payload, headers=headers)
    if resp.status_code < 300:
        return True, "sent via resend"
    return False, f"resend returned {resp.status_code}: {resp.text[:300]}"


async def _send_via_sendgrid(to_email: str, subject: str, html: str, from_email: str):
    payload = {
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": from_email},
        "subject": subject,
        "content": [{"type": "text/html", "value": html}],
    }
    headers = {"Authorization": f"Bearer {settings.SENDGRID_API_KEY}"}
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(SENDGRID_ENDPOINT, json=payload, headers=headers)
    if resp.status_code < 300:
        return True, "sent via sendgrid"
    return False, f"sendgrid returned {resp.status_code}: {resp.text[:300]}"


def _send_via_smtp_blocking(host, port, user, password, to_email, subject, html, from_email):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = to_email
    msg.attach(MIMEText(html, "html"))

    port = int(port)
    if port == 465:
        server = smtplib.SMTP_SSL(host, port, timeout=15)
    else:
        server = smtplib.SMTP(host, port, timeout=15)
        server.starttls()
    try:
        if user and password:
            server.login(user, password)
        server.sendmail(from_email, to_email, msg.as_string())
    finally:
        try:
            server.quit()
        except Exception:
            pass
    return True, f"sent via smtp {host}:{port}"


async def _send_via_smtp(platform_settings, to_email, subject, html, from_email):
    host = getattr(platform_settings, "smtp_host", None) or settings.MAIL_SERVER
    port = getattr(platform_settings, "smtp_port", None) or settings.MAIL_PORT
    user = getattr(platform_settings, "smtp_user", None) or settings.MAIL_USERNAME
    password = getattr(platform_settings, "smtp_pass", None) or settings.MAIL_PASSWORD

    if not host or "example.com" in str(host):
        return False, f"No email transport configured. {BLOCKED_SMTP_HINT}"

    try:
        return await asyncio.to_thread(
            _send_via_smtp_blocking,
            host, port, user, password, to_email, subject, html, from_email,
        )
    except OSError as exc:
        # Errno 101 / 111 / timeouts are what a blocked SMTP egress looks like.
        return False, f"SMTP connection to {host}:{port} failed ({exc}). {BLOCKED_SMTP_HINT}"
    except Exception as exc:
        return False, f"SMTP send to {to_email} failed: {exc}"


async def send_email(to_email: str, subject: str, html: str, platform_settings=None):
    """Send one HTML email. Returns (ok: bool, detail: str); never raises."""
    from_email = _from_address(platform_settings)

    if settings.BREVO_API_KEY:
        ok, detail = await _send_via_brevo(to_email, subject, html, from_email)
    elif settings.RESEND_API_KEY:
        ok, detail = await _send_via_resend(to_email, subject, html, from_email)
    elif settings.SENDGRID_API_KEY:
        ok, detail = await _send_via_sendgrid(to_email, subject, html, from_email)
    else:
        ok, detail = await _send_via_smtp(platform_settings, to_email, subject, html, from_email)

    global _last_delivery
    _last_delivery = {
        "to": to_email,
        "ok": ok,
        "detail": detail,
        "at": datetime.now(timezone.utc).isoformat(),
    }

    if ok:
        print(f"[EMAIL] Delivered to {to_email}: {detail}")
    else:
        print(f"[EMAIL ERROR] {to_email}: {detail}")
    return ok, detail


def transport_name() -> str:
    if settings.BREVO_API_KEY:
        return "brevo"
    if settings.RESEND_API_KEY:
        return "resend"
    if settings.SENDGRID_API_KEY:
        return "sendgrid"
    return "smtp"


def last_delivery() -> dict | None:
    """The most recent send attempt from this instance, or None if there was none."""
    return _last_delivery


def transport_status(platform_settings=None) -> dict:
    """Describe the mail transport that is actually in effect right now.

    The Super Admin console renders this, so it must reflect reality rather
    than an assumption: if nothing is configured it has to say so.
    """
    transport = transport_name()
    from_email = _from_address(platform_settings)

    if transport == "brevo":
        return {
            "transport": "brevo",
            "label": "Brevo (HTTPS API)",
            "configured": True,
            "from_email": from_email,
            "detail": "Sending over HTTPS. SMTP fields below are not used.",
            "last_delivery": _last_delivery,
        }
    if transport == "resend":
        return {
            "transport": "resend",
            "label": "Resend (HTTPS API)",
            "configured": True,
            "from_email": from_email,
            "detail": "Sending over HTTPS. SMTP fields below are not used.",
            "last_delivery": _last_delivery,
        }
    if transport == "sendgrid":
        return {
            "transport": "sendgrid",
            "label": "SendGrid (HTTPS API)",
            "configured": True,
            "from_email": from_email,
            "detail": "Sending over HTTPS. SMTP fields below are not used.",
            "last_delivery": _last_delivery,
        }

    host = getattr(platform_settings, "smtp_host", None) or settings.MAIL_SERVER
    port = getattr(platform_settings, "smtp_port", None) or settings.MAIL_PORT
    user = getattr(platform_settings, "smtp_user", None)
    password = getattr(platform_settings, "smtp_pass", None)

    configured = bool(host and "example.com" not in str(host) and user and password)
    detail = f"SMTP {host}:{port}" if configured else "No mail transport configured."
    if configured and str(port) in ("25", "465", "587"):
        detail += " - note: many PaaS hosts block this port outbound."

    return {
        "transport": "smtp",
        "label": f"SMTP ({host}:{port})" if configured else "Not configured",
        "configured": configured,
        "from_email": from_email,
        "detail": detail,
        "last_delivery": _last_delivery,
    }
