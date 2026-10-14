"""Relais des notifications de la plateforme vers l'e-mail et WhatsApp.

Chaque notification in-app (commande, paiement, message, livraison...) est aussi envoyee :
- par e-mail, des que le SMTP est configure (Brevo en production) ;
- par WhatsApp, des que l'API WhatsApp Cloud (Meta) et un modele de message approuve sont configures
  (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_NOTIFICATION_TEMPLATE). Meta impose un
  modele approuve pour ecrire a un client en premier ; sans lui, rien n'est envoye sur WhatsApp.

L'envoi se fait en arriere-plan : une requete n'attend jamais le serveur mail ou Meta.
Les rafales (ex. messages de discussion) sont limitees a un envoi par sujet toutes les 10 minutes.
"""

from __future__ import annotations

import json
import logging
import queue
import re
import threading
import time
from collections.abc import Callable
from urllib import error, request

from app.config import get_settings
from app.services.email_delivery_service import email_delivery_configured, send_email

logger = logging.getLogger(__name__)

THROTTLE_SECONDS = 600
_recent: dict[tuple[str, str], float] = {}
_lock = threading.Lock()
# Adresses internes (comptes crees avec un numero seul, comptes supprimes, demos) : jamais d'envoi.
INTERNAL_EMAIL_SUFFIXES = ("@users.amazer.ne", "@users.deleted.amazer.ne", "@amazer.demo")


def is_real_email(email: str | None) -> bool:
    return bool(email) and "@" in email and not email.lower().endswith(INTERNAL_EMAIL_SUFFIXES)


def _should_send(user_id: str, tag: str) -> bool:
    now = time.monotonic()
    key = (user_id, tag)
    with _lock:
        last = _recent.get(key)
        if last is not None and now - last < THROTTLE_SECONDS:
            return False
        _recent[key] = now
        if len(_recent) > 5000:  # borne memoire
            for old_key, sent_at in list(_recent.items()):
                if now - sent_at >= THROTTLE_SECONDS:
                    _recent.pop(old_key, None)
    return True


def whatsapp_number(phone: str | None) -> str | None:
    """Numero au format international sans « + » (Niger par defaut pour 8 chiffres)."""
    digits = re.sub(r"\D", "", phone or "")
    if digits.startswith("00"):
        digits = digits[2:]
    if len(digits) == 8:
        digits = f"227{digits}"
    return digits if 10 <= len(digits) <= 15 else None


def whatsapp_notifications_configured() -> bool:
    settings = get_settings()
    return bool(
        settings.whatsapp_access_token and settings.whatsapp_phone_number_id and settings.whatsapp_notification_template
    )


def _absolute_link(href: str | None) -> str:
    base = get_settings().public_site_url.rstrip("/")
    if not href:
        return base
    return href if href.startswith("http") else f"{base}/{href.lstrip('/')}"


def _send_email(email: str, title: str, body: str, href: str | None) -> None:
    text = f"{body}\n\nVoir sur AMAZER : {_absolute_link(href)}\n\n— L'équipe AMAZER"
    send_email(email, f"AMAZER · {title}", text)


def _send_whatsapp(phone: str, title: str, body: str, href: str | None) -> None:
    settings = get_settings()
    url = f"https://graph.facebook.com/{settings.whatsapp_api_version}/{settings.whatsapp_phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "template",
        "template": {
            "name": settings.whatsapp_notification_template,
            "language": {"code": settings.whatsapp_notification_language},
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": title[:60]},
                        {"type": "text", "text": f"{body[:500]} {_absolute_link(href)}"},
                    ],
                }
            ],
        },
    }
    http_request = request.Request(
        url=url,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={"Authorization": f"Bearer {settings.whatsapp_access_token}", "Content-Type": "application/json"},
    )
    try:
        with request.urlopen(http_request, timeout=15):
            pass
    except error.HTTPError as exc:
        logger.warning("Notification WhatsApp refusee (statut %s).", exc.code)
    except Exception as exc:  # noqa: BLE001 - reseau
        logger.warning("Notification WhatsApp impossible : %s", exc.__class__.__name__)


def relay_notification(
    *,
    user_id: str,
    email: str | None,
    phone: str | None,
    title: str,
    body: str,
    href: str | None,
    tag: str,
) -> bool:
    """Programme l'envoi e-mail / WhatsApp. Retourne True si au moins un canal est programme."""
    send_mail = is_real_email(email) and email_delivery_configured()
    number = whatsapp_number(phone) if whatsapp_notifications_configured() else None
    if not send_mail and not number:
        return False
    if not _should_send(user_id, tag):
        return False

    def _run() -> None:
        if send_mail:
            _send_email(email, title, body, href)  # type: ignore[arg-type]
        if number:
            _send_whatsapp(number, title, body, href)

    _enqueue(_run)
    return True


# File unique traitee par un seul fil : les envois groupes (messages admin) partent un par un,
# sans ouvrir des centaines de connexions SMTP en meme temps.
_queue: "queue.Queue[Callable[[], None]]" = queue.Queue()
_worker: threading.Thread | None = None


def _drain() -> None:
    while True:
        job = _queue.get()
        try:
            job()
        except Exception:  # noqa: BLE001 - un envoi rate ne doit pas arreter la file
            logger.exception("Envoi de notification en echec.")
        finally:
            _queue.task_done()


def _enqueue(job: Callable[[], None]) -> None:
    global _worker
    with _lock:
        if _worker is None or not _worker.is_alive():
            _worker = threading.Thread(target=_drain, name="notification-relay", daemon=True)
            _worker.start()
    _queue.put(job)
