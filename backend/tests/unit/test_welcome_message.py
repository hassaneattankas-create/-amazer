"""Message de bienvenue : réglé par l'admin, liens WhatsApp ajoutés, envoyé à l'inscription."""

import pytest
from pydantic import ValidationError

from app.routes.admin_finance import WelcomeSettings
from app.services import welcome_service as ws


def test_default_message_greets_by_first_name_without_links() -> None:
    title, body = ws.render({"title": ws.DEFAULT_TITLE, "message": ws.DEFAULT_MESSAGE, "whatsapp_group_url": None, "whatsapp_channel_url": None}, "Aïcha Issa")
    assert title == "Bienvenue sur AMAZER"
    assert body.startswith("Bonjour Aïcha, votre compte est prêt.")
    assert "WhatsApp AMAZER" not in body


def test_admin_message_and_whatsapp_links_are_sent() -> None:
    values = {"title": "Bienvenue !", "message": "Salut {prenom} ! Merci de nous rejoindre.", "whatsapp_group_url": "https://chat.whatsapp.com/ABC", "whatsapp_channel_url": "https://whatsapp.com/channel/XYZ"}
    title, body = ws.render(values, "Moussa")
    assert title == "Bienvenue !"
    assert body.splitlines()[0] == "Salut Moussa ! Merci de nous rejoindre."
    assert "Rejoignez le groupe WhatsApp AMAZER : https://chat.whatsapp.com/ABC" in body
    assert "Suivez la chaîne WhatsApp AMAZER : https://whatsapp.com/channel/XYZ" in body


def test_missing_name_keeps_a_clean_greeting() -> None:
    _, body = ws.render({"title": "T", "message": "Bonjour {prenom}, bienvenue.", "whatsapp_group_url": None, "whatsapp_channel_url": None}, None)
    assert body == "Bonjour, bienvenue."


def test_links_must_be_https() -> None:
    with pytest.raises(ValidationError):
        WelcomeSettings(title="Bienvenue", message="Bonjour {prenom}, bienvenue.", whatsapp_group_url="chat.whatsapp.com/ABC")
    ok = WelcomeSettings(title="Bienvenue", message="Bonjour {prenom}, bienvenue.", whatsapp_group_url="", whatsapp_channel_url=None)
    assert ok.whatsapp_group_url is None
