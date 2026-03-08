from __future__ import annotations

import json
import logging
from urllib import error, request

from app.config import get_settings

logger = logging.getLogger(__name__)


def send_verification_code_via_whatsapp(phone_number: str, code: str) -> bool:
    settings = get_settings()
    if not settings.whatsapp_verification_enabled:
        return False
    if not settings.whatsapp_access_token or not settings.whatsapp_phone_number_id:
        logger.warning("WhatsApp verification is not configured; falling back to preview mode.")
        return False

    url = (
        f"https://graph.facebook.com/{settings.whatsapp_api_version}/"
        f"{settings.whatsapp_phone_number_id}/messages"
    )
    payload = {
        "messaging_product": "whatsapp",
        "to": phone_number,
        "type": "text",
        "text": {
            "preview_url": False,
            "body": (
                f"AMAZER: votre code de verification est {code}. "
                f"Il expire dans {settings.verification_code_ttl_minutes} minutes."
            ),
        },
    }
    http_request = request.Request(
        url=url,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {settings.whatsapp_access_token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with request.urlopen(http_request, timeout=15) as response:
            status_code = getattr(response, "status", 200)
            return 200 <= int(status_code) < 300
    except error.HTTPError as exc:
        logger.warning("WhatsApp verification delivery failed with status %s", exc.code)
        return False
    except Exception as exc:  # pragma: no cover - network dependent
        logger.warning("WhatsApp verification delivery failed: %s", exc)
        return False
