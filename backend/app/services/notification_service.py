from __future__ import annotations

import json
import logging
import re
from urllib import error, request

from app.config import get_settings

logger = logging.getLogger("amazer.notification")
settings = get_settings()


def _normalize_phone(phone: str) -> str:
    cleaned = re.sub(r"[^\d+]", "", phone.strip())
    if cleaned.startswith("+"):
        cleaned = cleaned[1:]
    return cleaned


def _send_whatsapp_text(*, destination: str, message: str) -> tuple[bool, str]:
    if not settings.whatsapp_api_token or not settings.whatsapp_phone_number_id:
        logger.warning("WHATSAPP_NOT_CONFIGURED destination=%s", destination)
        return False, "config_missing"

    to = _normalize_phone(destination)
    url = (
        f"https://graph.facebook.com/{settings.whatsapp_api_version}/"
        f"{settings.whatsapp_phone_number_id}/messages"
    )
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"preview_url": False, "body": message},
    }
    req = request.Request(
        url=url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.whatsapp_api_token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=15) as response:
            code = response.getcode()
            if 200 <= code < 300:
                return True, "ok"
            return False, f"http_{code}"
    except error.HTTPError as exc:
        detail = ""
        try:
            detail = exc.read().decode("utf-8")
        except Exception:
            detail = str(exc)
        logger.warning("WHATSAPP_SEND_HTTP_ERROR destination=%s code=%s detail=%s", destination, exc.code, detail)
        return False, f"http_{exc.code}"
    except Exception as exc:
        logger.warning("WHATSAPP_SEND_FAILED destination=%s error=%s", destination, exc)
        lowered = str(exc).lower()
        if "timed out" in lowered:
            return False, "timeout"
        return False, "network_error"


def send_login_verification_code(*, destination: str, code: str) -> bool:
    message = (
        "AMAZER\n"
        f"Code de connexion: {code}\n"
        "Ce code expire dans 5 minutes.\n"
        "Ne le partagez avec personne."
    )
    delivered, reason = _send_whatsapp_text(destination=destination, message=message)
    if not delivered:
        logger.warning("LOGIN_CODE_SEND_FAILED destination=%s reason=%s", destination, reason)
    return delivered


def send_payment_confirmation(
    *,
    recipient: str,
    order_id: str,
    amount: float,
    receipt_url: str | None = None,
    qr_payload: str | None = None,
) -> None:
    _ = qr_payload
    receipt_line = receipt_url or "https://amazer.vercel.app"
    message = (
        "AMAZER - Paiement confirme\n"
        f"Commande: {order_id}\n"
        f"Montant: {amount:.0f} XOF\n"
        f"Recu: {receipt_line}"
    )
    delivered, reason = _send_whatsapp_text(destination=recipient, message=message)
    if delivered:
        logger.info("PAYMENT_CONFIRMATION_SENT destination=%s order_id=%s", recipient, order_id)
    else:
        logger.warning(
            "PAYMENT_CONFIRMATION_FAILED destination=%s order_id=%s reason=%s",
            recipient,
            order_id,
            reason,
        )
