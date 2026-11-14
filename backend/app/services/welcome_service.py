"""Message de bienvenue envoyé à chaque inscription, modifiable par l'admin.

Il part comme une notification (site + téléphone) et, comme toutes les notifications, il est
recopié par e-mail et par WhatsApp quand ces envois sont configurés. Il contient les liens
du groupe et de la chaîne WhatsApp d'AMAZER s'ils sont renseignés.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.global_settings import GlobalSettings

DEFAULT_TITLE = "Bienvenue sur AMAZER"
DEFAULT_MESSAGE = (
    "Bonjour {prenom}, votre compte est prêt. Achetez en toute confiance : paiement contrôlé et livraison suivie. "
    "Astuce : devenez affilié gratuitement dans « Affiliation » et gagnez de l'argent en partageant AMAZER."
)
WELCOME_PAGE = "/bienvenue"


def _settings(db: Session) -> GlobalSettings | None:
    return db.scalar(select(GlobalSettings).order_by(GlobalSettings.id.asc()))


def current(db: Session) -> dict[str, str | None]:
    """Réglages actuels (valeurs par défaut si l'admin n'a rien changé)."""
    row = _settings(db)
    return {
        "title": (getattr(row, "welcome_title", None) or "").strip() or DEFAULT_TITLE,
        "message": (getattr(row, "welcome_message", None) or "").strip() or DEFAULT_MESSAGE,
        "whatsapp_group_url": (getattr(row, "whatsapp_group_url", None) or "").strip() or None,
        "whatsapp_channel_url": (getattr(row, "whatsapp_channel_url", None) or "").strip() or None,
    }


def render(values: dict[str, str | None], full_name: str | None) -> tuple[str, str]:
    """Titre et texte envoyés : {prenom} remplacé, liens WhatsApp ajoutés à la fin."""
    first = (full_name or "").strip().split(" ")[0]
    body = str(values["message"]).replace("{prenom}", first).replace("Bonjour , ", "Bonjour, ").replace("Bonjour ,", "Bonjour,")
    links = []
    if values.get("whatsapp_group_url"):
        links.append(f"Rejoignez le groupe WhatsApp AMAZER : {values['whatsapp_group_url']}")
    if values.get("whatsapp_channel_url"):
        links.append(f"Suivez la chaîne WhatsApp AMAZER : {values['whatsapp_channel_url']}")
    if links:
        body = body.rstrip() + "\n\n" + "\n".join(links)
    return str(values["title"]), body[:2000]


def save(db: Session, *, title: str, message: str, whatsapp_group_url: str | None, whatsapp_channel_url: str | None) -> dict[str, str | None]:
    row = _settings(db)
    if row is None:
        row = GlobalSettings()
        db.add(row)
    row.welcome_title = title.strip() or None
    row.welcome_message = message.strip() or None
    row.whatsapp_group_url = (whatsapp_group_url or "").strip() or None
    row.whatsapp_channel_url = (whatsapp_channel_url or "").strip() or None
    db.flush()
    return current(db)
