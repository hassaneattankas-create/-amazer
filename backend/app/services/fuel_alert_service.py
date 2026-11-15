"""Alertes carburant (« Me prévenir ») et signalements des clients (« Vous y êtes ? »).

Une alerte part quand une station passe d'« indisponible » (rupture, inconnu) à « disponible » ou « stock
faible » pour le carburant suivi, ou quand AMAZER publie un communiqué d'approvisionnement de la ville.
Au plus une alerte toutes les 2 heures par abonnement. L'envoi se fait après l'enregistrement, en
arrière-plan : la mise à jour du gérant n'attend jamais les notifications.
"""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import event, or_, select
from sqlalchemy.orm import Session

from app.models.fuel_alert import FuelAlert, FuelSignal
from app.models.fuel_outlet import FuelOutlet
from app.models.seller_profile import SellerProfile
from app.services import local_services as svc

logger = logging.getLogger(__name__)

FUELS = ("super", "gasoil", "gaz")
FUEL_NAMES = {"super": "Super", "gasoil": "Gasoil", "gaz": "Gaz", "any": "Carburant"}
SIGNAL_KINDS = ("found", "out", "queue")
AVAILABLE = ("available", "low")
THROTTLE = timedelta(hours=2)
SIGNAL_WINDOW = timedelta(hours=2)
MAX_ALERTS_PER_USER = 10
_PENDING = "fuel_alerts_pending"


@dataclass(frozen=True)
class Opening:
    """Un carburant qui vient de redevenir disponible dans une station."""

    vendor_id: str
    outlet_id: str | None
    fuel: str


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def became_available(old: str | None, new: str | None) -> bool:
    return new in AVAILABLE and old not in AVAILABLE


# ---------------------------------------------------------------- abonnements
def matching_alerts(db: Session, opening: Opening, city: str | None, now: datetime) -> list[FuelAlert]:
    """Abonnements concernés (station, marque, ou ville), hors ceux déjà prévenus il y a moins de 2 heures."""
    scope = [FuelAlert.vendor_id == opening.vendor_id]
    if opening.outlet_id:
        scope = [FuelAlert.outlet_id == opening.outlet_id, (FuelAlert.vendor_id == opening.vendor_id) & FuelAlert.outlet_id.is_(None)]
    if city:
        scope.append(FuelAlert.city_key == svc.normalize_city(city))
    rows = db.scalars(select(FuelAlert).where(or_(*scope), FuelAlert.fuel.in_((opening.fuel, "any")))).all()
    return [a for a in rows if a.last_sent_at is None or _aware(a.last_sent_at) <= now - THROTTLE]


def _place(db: Session, opening: Opening) -> tuple[str, str | None]:
    """(nom affiché, ville) de la station."""
    profile = db.scalar(select(SellerProfile).where(SellerProfile.vendor_id == opening.vendor_id))
    brand = profile.business_name if profile else "Station"
    if opening.outlet_id:
        outlet = db.get(FuelOutlet, opening.outlet_id)
        if outlet is not None:
            return f"{brand} · {outlet.name}", outlet.city
    return brand, getattr(profile, "city", None)


def deliver(db: Session, openings: list[Opening], now: datetime | None = None) -> int:
    """Envoie les alertes (une par client et par station/carburant) ; renvoie le nombre de notifications."""
    from app.services.notification_service import NotificationPayload, NotificationService

    now = now or datetime.now(UTC)
    sent = 0
    seen: set[tuple[str, str, str]] = set()
    service = NotificationService(db)
    for opening in openings:
        name, city = _place(db, opening)
        for alert in matching_alerts(db, opening, city, now):
            key = (alert.user_id, opening.outlet_id or opening.vendor_id, opening.fuel)
            if key in seen:
                alert.last_sent_at = now
                continue
            seen.add(key)
            fuel = FUEL_NAMES.get(opening.fuel, opening.fuel)
            service.send_to_user(
                user_id=alert.user_id,
                payload=NotificationPayload(
                    title=f"⛽ {fuel} disponible · {name}",
                    body=f"La station vient d'indiquer du {fuel.lower()} disponible{f' ({city})' if city else ''}. Appelez avant d'y aller : itinéraire dans AMAZER.",
                    data={"tag": f"fuel-{opening.outlet_id or opening.vendor_id}-{opening.fuel}", "href": "/stations"},
                ),
            )
            alert.last_sent_at = now
            sent += 1
    db.commit()
    return sent


def deliver_supply_list(db: Session, city: str, fuel: str | None, title: str, count: int, now: datetime | None = None) -> int:
    """Communiqué d'approvisionnement publié : alerte aux abonnés de la ville pour ce carburant."""
    from app.services.notification_service import NotificationPayload, NotificationService

    now = now or datetime.now(UTC)
    fuels = (fuel, "any") if fuel else (*FUELS, "any")
    rows = db.scalars(select(FuelAlert).where(FuelAlert.city_key == svc.normalize_city(city), FuelAlert.fuel.in_(fuels))).all()
    service = NotificationService(db)
    sent = 0
    for alert in rows:
        if alert.last_sent_at is not None and _aware(alert.last_sent_at) > now - THROTTLE:
            continue
        service.send_to_user(
            user_id=alert.user_id,
            payload=NotificationPayload(
                title=f"⛽ {title}",
                body=f"{count} station(s) approvisionnée(s) à {city} selon le communiqué. Voir la liste et la carte dans AMAZER.",
                data={"tag": f"fuel-list-{svc.normalize_city(city)}-{fuel or 'all'}", "href": "/stations"},
            ),
        )
        alert.last_sent_at = now
        sent += 1
    db.commit()
    return sent


def _in_background(task) -> None:
    """Exécute `task(session)` dans un fil séparé, avec sa propre session (jamais pendant les tests)."""
    import os

    from app.config import get_settings

    if os.environ.get("PYTEST_CURRENT_TEST") or get_settings().app_env.lower() in ("test", "testing"):
        return

    def run() -> None:
        from app.database import SessionLocal

        session = SessionLocal()
        try:
            task(session)
        except Exception:  # noqa: BLE001 - une alerte ne doit jamais faire échouer autre chose
            session.rollback()
            logger.exception("Envoi des alertes carburant impossible.")
        finally:
            session.close()

    threading.Thread(target=run, name="fuel-alerts", daemon=True).start()


def queue_changes(db: Session, vendor_id: str, outlet_id: str | None, changes: list[tuple[str, str | None, str]]) -> None:
    """Retient les carburants redevenus disponibles ; les alertes partent après l'enregistrement (commit)."""
    openings = [Opening(vendor_id, outlet_id, fuel) for fuel, old, new in changes if became_available(old, new)]
    if not openings:
        return
    pending: list[Opening] = db.info.setdefault(_PENDING, [])
    first = not pending
    pending.extend(openings)
    if not first:
        return

    def after_commit(session: Session) -> None:
        batch = list(session.info.pop(_PENDING, []))
        if batch:
            _in_background(lambda s: deliver(s, batch))

    def after_rollback(session: Session) -> None:
        session.info.pop(_PENDING, None)

    event.listen(db, "after_commit", after_commit, once=True)
    event.listen(db, "after_soft_rollback", lambda session, previous: after_rollback(session), once=True)


def queue_supply_list(city: str, fuel: str | None, title: str, count: int) -> None:
    _in_background(lambda s: deliver_supply_list(s, city, fuel, title, count))


def subscribe(db: Session, user_id: str, fuel: str, *, outlet_id: str | None, vendor_id: str | None, city: str | None) -> FuelAlert:
    """Nouvel abonnement (ou le même s'il existe déjà) ; 10 au plus par client."""
    city_key = svc.normalize_city(city) if city else None
    existing = db.scalar(
        select(FuelAlert).where(
            FuelAlert.user_id == user_id,
            FuelAlert.fuel == fuel,
            FuelAlert.outlet_id.is_(None) if outlet_id is None else FuelAlert.outlet_id == outlet_id,
            FuelAlert.vendor_id.is_(None) if vendor_id is None else FuelAlert.vendor_id == vendor_id,
            FuelAlert.city_key.is_(None) if city_key is None else FuelAlert.city_key == city_key,
        )
    )
    if existing is not None:
        return existing
    count = len(db.scalars(select(FuelAlert.id).where(FuelAlert.user_id == user_id)).all())
    if count >= MAX_ALERTS_PER_USER:
        from app.core.exceptions import ValidationDomainError

        raise ValidationDomainError(f"{MAX_ALERTS_PER_USER} alertes au maximum : retirez-en une avant d'en ajouter.")
    alert = FuelAlert(user_id=user_id, fuel=fuel, outlet_id=outlet_id, vendor_id=vendor_id, city=city, city_key=city_key)
    db.add(alert)
    db.flush()
    return alert


# ---------------------------------------------------------------- signalements des clients
@dataclass
class Crowd:
    found: set[str]
    out: set[str]
    queue: int
    last: datetime | None


def crowd(db: Session, now: datetime | None = None) -> dict[tuple[str, str | None], Crowd]:
    """Signalements des 2 dernières heures, par station (vendor_id, outlet_id). Le plus récent l'emporte par carburant."""
    now = now or datetime.now(UTC)
    rows = db.scalars(select(FuelSignal).where(FuelSignal.created_at >= now - SIGNAL_WINDOW).order_by(FuelSignal.created_at)).all()
    result: dict[tuple[str, str | None], Crowd] = {}
    for row in rows:
        entry = result.setdefault((row.vendor_id, row.outlet_id), Crowd(set(), set(), 0, None))
        if row.kind == "queue":
            entry.queue += 1
        elif row.fuel:
            # Dernier signalement par carburant : « plus rien » après « il y en a » remplace l'information.
            (entry.found if row.kind == "found" else entry.out).add(row.fuel)
            (entry.out if row.kind == "found" else entry.found).discard(row.fuel)
        entry.last = _aware(row.created_at)
    return result
