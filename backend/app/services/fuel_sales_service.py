"""Carburant vendu, d'après les compteurs des pompes.

Chaque pompe a un compteur qui cumule les litres servis. Le gérant recopie le chiffre (le soir, en général) :
vendu entre deux relevés = compteur du relevé − compteur du relevé précédent, compté le jour du relevé.
Le premier relevé d'une pompe sert de départ. Un compteur remis à zéro (ou changé) repart sans vente comptée.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import ValidationDomainError
from app.models.fuel_activity import FuelMeterReading, FuelPump
from app.models.fuel_outlet import FuelOutlet
from app.models.user import User
from app.services import local_services as svc
from app.services.station_access import FUEL_LABELS, format_quantity, log_activity

PUMP_FUELS = ("super", "gasoil")
MAX_PUMPS = 24
# Au-delà, c'est presque sûrement une erreur de frappe (une pompe ne sert pas 100 000 L entre deux relevés).
MAX_STEP = 100_000
HISTORY_DAYS = 120


def active_pumps(db: Session, outlet_ids: list[str]) -> list[FuelPump]:
    if not outlet_ids:
        return []
    return list(
        db.scalars(
            select(FuelPump).where(FuelPump.outlet_id.in_(outlet_ids), FuelPump.is_active.is_(True)).order_by(FuelPump.fuel.desc(), FuelPump.name)
        ).all()
    )


def last_readings(db: Session, pump_ids: list[str]) -> dict[str, FuelMeterReading]:
    result: dict[str, FuelMeterReading] = {}
    if not pump_ids:
        return result
    for row in db.scalars(select(FuelMeterReading).where(FuelMeterReading.pump_id.in_(pump_ids)).order_by(FuelMeterReading.read_at)).all():
        result[row.pump_id] = row
    return result


def add_pump(db: Session, *, outlet: FuelOutlet, user: User, role: str, fuel: str, name: str) -> FuelPump:
    if fuel not in PUMP_FUELS:
        raise ValidationDomainError("Une pompe sert du super ou du gasoil.")
    pumps = active_pumps(db, [outlet.id])
    if len(pumps) >= MAX_PUMPS:
        raise ValidationDomainError(f"{MAX_PUMPS} pompes au maximum par station.")
    clean = " ".join(name.split())[:60]
    if any(svc.normalize_city(p.name) == svc.normalize_city(clean) for p in pumps):
        raise ValidationDomainError(f"La pompe « {clean} » existe déjà.")
    pump = FuelPump(vendor_id=outlet.vendor_id, outlet_id=outlet.id, fuel=fuel, name=clean)
    db.add(pump)
    log_activity(db, vendor_id=outlet.vendor_id, outlet=outlet, user=user, role=role, action="pump", detail=f"Pompe ajoutée : {clean} ({FUEL_LABELS[fuel]})")
    db.commit()
    return pump


def remove_pump(db: Session, *, outlet: FuelOutlet, pump: FuelPump, user: User, role: str) -> None:
    pump.is_active = False
    log_activity(db, vendor_id=outlet.vendor_id, outlet=outlet, user=user, role=role, action="pump", detail=f"Pompe retirée : {pump.name}")
    db.commit()


def record_readings(db: Session, *, outlet: FuelOutlet, user: User, role: str, readings: list[tuple[str, float, bool]], now: datetime) -> dict[str, float]:
    """Enregistre les compteurs (pompe, chiffre, remis à zéro) ; renvoie les litres vendus depuis le relevé précédent."""
    pumps = {p.id: p for p in active_pumps(db, [outlet.id])}
    previous = last_readings(db, list(pumps))
    sold: dict[str, float] = defaultdict(float)
    seen: set[str] = set()
    rows: list[FuelMeterReading] = []
    for pump_id, meter, reset in readings:
        pump = pumps.get(pump_id)
        if pump is None:
            raise ValidationDomainError("Pompe introuvable : rechargez la page.")
        if pump_id in seen:
            raise ValidationDomainError(f"{pump.name} : un seul chiffre par pompe.")
        seen.add(pump_id)
        last = previous.get(pump_id)
        if last is not None and not reset:
            step = meter - last.meter
            if step < 0:
                raise ValidationDomainError(
                    f"{pump.name} : {format_quantity(round(meter))} est plus petit que le dernier relevé ({format_quantity(round(last.meter))}). "
                    "Vérifiez le chiffre, ou cochez « compteur remis à zéro »."
                )
            if step > MAX_STEP:
                raise ValidationDomainError(f"{pump.name} : {format_quantity(round(step))} L depuis le dernier relevé, c'est trop. Vérifiez le chiffre.")
            sold[pump.fuel] += step
        rows.append(FuelMeterReading(vendor_id=outlet.vendor_id, outlet_id=outlet.id, pump_id=pump_id, fuel=pump.fuel, meter=meter, reset=reset, read_at=now, user_id=user.id))
    if not rows:
        raise ValidationDomainError("Écrivez au moins un compteur.")
    db.add_all(rows)
    parts = [f"{FUEL_LABELS[f]} {format_quantity(round(v))} L" for f, v in sold.items() if v > 0]
    detail = "Relevé des compteurs" + (f" : vendu {', '.join(parts)}" if parts else " (point de départ)")
    log_activity(db, vendor_id=outlet.vendor_id, outlet=outlet, user=user, role=role, action="meters", detail=detail)
    db.commit()
    return dict(sold)


def daily_sales(db: Session, outlet_ids: list[str], days: int, now: datetime | None = None) -> dict[str, dict[date, dict[str, float]]]:
    """Litres vendus par station, par jour (heure de Niamey) et par carburant, sur les « days » derniers jours."""
    now = now or datetime.now(UTC)
    first_day = svc.niamey_today(now) - timedelta(days=days - 1)
    result: dict[str, dict[date, dict[str, float]]] = {oid: {} for oid in outlet_ids}
    if not outlet_ids:
        return result
    since = now - timedelta(days=days + HISTORY_DAYS)
    rows = db.scalars(
        select(FuelMeterReading).where(FuelMeterReading.outlet_id.in_(outlet_ids), FuelMeterReading.read_at >= since).order_by(FuelMeterReading.read_at)
    ).all()
    last: dict[str, FuelMeterReading] = {}
    for row in rows:
        prev = last.get(row.pump_id)
        last[row.pump_id] = row
        if prev is None or row.reset:
            continue
        step = row.meter - prev.meter
        if step <= 0:
            continue
        day = svc._aware(row.read_at).astimezone(svc.NIAMEY_TZ).date()
        if day < first_day:
            continue
        bucket = result[row.outlet_id].setdefault(day, {})
        bucket[row.fuel] = bucket.get(row.fuel, 0.0) + step
    return result


def day_list(sales: dict[date, dict[str, float]], days: int, now: datetime | None = None) -> list[dict]:
    """Jours du plus récent au plus ancien, avec 0 quand rien n'a été relevé."""
    today = svc.niamey_today(now or datetime.now(UTC))
    out = []
    for i in range(days):
        day = today - timedelta(days=i)
        values = sales.get(day, {})
        out.append({"day": day, "super": round(values.get("super", 0.0)), "gasoil": round(values.get("gasoil", 0.0))})
    return out
