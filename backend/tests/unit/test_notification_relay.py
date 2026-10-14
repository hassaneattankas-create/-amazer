"""Les notifications partent aussi par e-mail / WhatsApp, sans spam ni envoi fantome."""

import pytest

from app.services import notification_relay_service as relay


@pytest.fixture(autouse=True)
def _reset(monkeypatch):
    relay._recent.clear()
    sent: list[tuple] = []

    class _InlineThread:
        def __init__(self, target, **_kwargs):
            self._target = target

        def start(self):
            self._target()

    monkeypatch.setattr(relay.threading, "Thread", _InlineThread)
    monkeypatch.setattr(relay, "_send_email", lambda *a: sent.append(("email", *a)))
    monkeypatch.setattr(relay, "_send_whatsapp", lambda *a: sent.append(("whatsapp", *a)))
    return sent


def _relay(email="client@example.test", phone="96 95 31 63", tag="order-1"):
    return relay.relay_notification(
        user_id="u-1", email=email, phone=phone, title="Commande payée", body="Votre commande est confirmée.",
        href="/order/success/o-1", tag=tag,
    )


def test_email_sent_when_smtp_configured(monkeypatch, _reset) -> None:
    monkeypatch.setattr(relay, "email_delivery_configured", lambda: True)
    monkeypatch.setattr(relay, "whatsapp_notifications_configured", lambda: False)
    assert _relay() is True
    assert [row[0] for row in _reset] == ["email"]


def test_whatsapp_sent_when_template_configured(monkeypatch, _reset) -> None:
    monkeypatch.setattr(relay, "email_delivery_configured", lambda: False)
    monkeypatch.setattr(relay, "whatsapp_notifications_configured", lambda: True)
    assert _relay() is True
    assert _reset == [("whatsapp", "22796953163", "Commande payée", "Votre commande est confirmée.", "/order/success/o-1")]


def test_nothing_sent_when_no_channel_configured(monkeypatch, _reset) -> None:
    monkeypatch.setattr(relay, "email_delivery_configured", lambda: False)
    monkeypatch.setattr(relay, "whatsapp_notifications_configured", lambda: False)
    assert _relay() is False and _reset == []


def test_bursts_are_throttled_and_deleted_accounts_skipped(monkeypatch, _reset) -> None:
    monkeypatch.setattr(relay, "email_delivery_configured", lambda: True)
    monkeypatch.setattr(relay, "whatsapp_notifications_configured", lambda: False)
    assert _relay(tag="conversation-9") is True
    assert _relay(tag="conversation-9") is False  # meme sujet dans les 10 minutes
    assert _relay(email="deleted-x@users.deleted.amazer.ne", tag="autre") is False
    assert len(_reset) == 1


@pytest.mark.parametrize(
    ("raw", "expected"),
    [("+227 96 95 31 63", "22796953163"), ("96953163", "22796953163"), ("0033612345678", "33612345678"), ("12", None)],
)
def test_whatsapp_number_format(raw, expected) -> None:
    assert relay.whatsapp_number(raw) == expected
