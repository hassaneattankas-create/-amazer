"""Taches automatiques des stations-essence (lancees au plus une fois par heure par /ping).

- Relance : une station dont la disponibilite n'est plus confirmee previent ses gerants
  (ou le proprietaire s'il n'y en a pas), une fois par periode « non confirmee » et au plus une fois par 24 h,
  seulement de 7 h a 21 h (heure de Niamey).
- Rapport mensuel : les 3 premiers jours du mois, le proprietaire recoit ce que ses stations ont rapporte
  le mois precedent (itineraires, appels, commandes de gaz, ruptures declarees).
"""

from __future__ import annotations

import logging
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.fuel_history import FuelStatusChange
from app.models.fuel_outlet import FuelOutlet, FuelOutletManager
from app.models.fuel_outlet_stat import FuelOutletDailyStat
from app.models.seller_profile import SellerProfile
from app.models.user import User
from app.models.vendor import Vendor
from app.repositories.catalog_repository import active_subscription_clause
from app.services import local_services as svc
from app.services.email_delivery_service import email_delivery_configured, send_email
from app.services.notification_service import NotificationPayload, NotificationService
from app.services.seller_finance_service import get_or_create_global_settings

logger = logging.getLogger(__name__)
SITE = "https://amazer.store"
MONTHS = ("janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre")
REPORT_DAYS = 3


def _station_profiles(db: Session) -> list[SellerProfile]:
    stmt = (
        select(SellerProfile)
        .join(Vendor, Vendor.id == SellerProfile.vendor_id)
        .where(SellerProfile.service_kind == "fuel_station", Vendor.is_active.is_(True))
        .where(active_subscription_clause())
    )
    return list(db.scalars(stmt).all())


def reminder_due(reminded_at: datetime | None, updated_at: datetime | None, now: datetime) -> bool:
    """Une relance par periode « non confirmee », et pas plus d'une fois par 24 h."""
    reminded, updated = svc._aware(reminded_at), svc._aware(updated_at)
    if reminded is None:
        return True
    if updated is not None and reminded < updated:
        return True
    return now - reminded >= timedelta(hours=24)


def _notify(db: Session, user_id: str, title: str, body: str, tag: str, href: str) -> None:
    try:
        with db.begin_nested():
            NotificationService(db).send_to_user(user_id=user_id, payload=NotificationPayload(title=title, body=body, data={"tag": tag, "href": href}))
    except Exception:  # noqa: BLE001 - une notification ratee ne bloque pas les autres
        logger.exception("Notification station impossible (%s).", tag)
    user = db.get(User, user_id)
    if user is not None and user.email and email_delivery_configured():
        send_email(user.email, f"AMAZER · {title}", f"{body}\n\n{SITE}{href}\n\nL'équipe AMAZER")


def send_station_reminders(db: Session, now: datetime) -> int:
    hours = svc.fresh_hours(get_or_create_global_settings(db))
    todo: dict[str, list[str]] = {}
    managed_users: set[str] = set()
    for profile in _station_profiles(db):
        outlets = db.scalars(select(FuelOutlet).where(FuelOutlet.vendor_id == profile.vendor_id, FuelOutlet.is_active.is_(True))).all()
        if outlets:
            managers: dict[str, list[str]] = {}
            for row in db.scalars(select(FuelOutletManager).where(FuelOutletManager.vendor_id == profile.vendor_id)).all():
                managers.setdefault(row.outlet_id, []).append(row.user_id)
            for outlet in outlets:
                if svc.fuel_is_fresh(outlet, now, hours) or not reminder_due(outlet.reminded_at, outlet.fuel_updated_at, now):
                    continue
                recipients = managers.get(outlet.id) or [profile.user_id]
                for user_id in recipients:
                    todo.setdefault(user_id, []).append(f"{profile.business_name} · {outlet.name}")
                managed_users.update(managers.get(outlet.id, []))
                outlet.reminded_at = now
        elif not svc.fuel_is_fresh(profile, now, hours) and reminder_due(profile.fuel_reminded_at, profile.fuel_updated_at, now):
            todo.setdefault(profile.user_id, []).append(profile.business_name)
            profile.fuel_reminded_at = now
    db.commit()
    for user_id, names in todo.items():
        shown = ", ".join(names[:5]) + (f" et {len(names) - 5} autre(s)" if len(names) > 5 else "")
        plural = len(names) > 1
        body = (
            f"{'Ces stations ne sont plus confirmées' if plural else 'Cette station n’est plus confirmée'} pour les clients : {shown}. "
            "Indiquez en un geste ce qui est disponible (ou « Rien n'a changé ») : les stations à jour apparaissent en premier."
        )
        href = "/gerant-station" if user_id in managed_users else "/seller/dashboard"
        _notify(db, user_id, "Mettez à jour vos disponibilités", body, f"fuel-reminder-{now:%Y%m%d%H}", href)
    db.commit()
    return len(todo)


def _previous_month(today: date) -> tuple[date, date, str]:
    end = today.replace(day=1)
    start = (end - timedelta(days=1)).replace(day=1)
    return start, end, f"{start:%Y-%m}"


def send_monthly_reports(db: Session, now: datetime) -> int:
    today = svc.niamey_today(now)
    if today.day > REPORT_DAYS:
        return 0
    start, end, label = _previous_month(today)
    sent = 0
    for profile in _station_profiles(db):
        if profile.fuel_report_month == label:
            continue
        outlets = db.scalars(select(FuelOutlet).where(FuelOutlet.vendor_id == profile.vendor_id)).all()
        profile.fuel_report_month = label
        if not outlets:
            continue
        names = {o.id: o.name for o in outlets}
        rows = db.execute(
            select(FuelOutletDailyStat.outlet_id, func.sum(FuelOutletDailyStat.routes), func.sum(FuelOutletDailyStat.calls), func.sum(FuelOutletDailyStat.gas_orders))
            .where(FuelOutletDailyStat.outlet_id.in_(list(names)), FuelOutletDailyStat.day >= start, FuelOutletDailyStat.day < end)
            .group_by(FuelOutletDailyStat.outlet_id)
        ).all()
        per = {r[0]: (int(r[1] or 0), int(r[2] or 0), int(r[3] or 0)) for r in rows}
        routes, calls, gas = (sum(v[i] for v in per.values()) for i in range(3))
        since = datetime(start.year, start.month, start.day, tzinfo=svc.NIAMEY_TZ)
        until = datetime(end.year, end.month, end.day, tzinfo=svc.NIAMEY_TZ)
        ruptures = int(
            db.scalar(
                select(func.count()).select_from(FuelStatusChange).where(
                    FuelStatusChange.vendor_id == profile.vendor_id,
                    FuelStatusChange.new_state == "out",
                    FuelStatusChange.created_at >= since,
                    FuelStatusChange.created_at < until,
                )
            )
            or 0
        )
        top = sorted(per.items(), key=lambda kv: -(kv[1][0] + kv[1][1] + kv[1][2]))[:10]
        lines = [f"- {names[oid]} : {r} itinéraires, {c} appels, {g} commandes de gaz" for oid, (r, c, g) in top]
        month = f"{MONTHS[start.month - 1]} {start.year}"
        body = (
            f"En {month}, AMAZER a envoyé vers vos stations {routes} itinéraire(s), {calls} appel(s) et {gas} commande(s) de gaz. "
            f"Ruptures déclarées : {ruptures}."
        )
        detail = "\n".join(lines)
        _notify(db, profile.user_id, f"Votre rapport de {month}", body + (f"\n\nPar station :\n{detail}" if detail else ""), f"fuel-report-{label}", "/seller/dashboard")
        sent += 1
    db.commit()
    return sent


def run_station_tasks(db: Session, now: datetime | None = None) -> dict[str, int]:
    now = now or datetime.now(UTC)
    hour = now.astimezone(svc.NIAMEY_TZ).hour
    summary = {"reminders": 0, "reports": 0}
    if 7 <= hour < 21:
        summary["reminders"] = send_station_reminders(db, now)
    if hour >= 8:
        summary["reports"] = send_monthly_reports(db, now)
    return summary
