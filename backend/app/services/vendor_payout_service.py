"""Reversements aux boutiques : l'argent des commandes de boutiques arrive sur le compte AMAZER.

Pour chaque part de commande (OrderFulfillment) suivie (payout_status « pending » ou « paid ») :
- a reverser quand la part est livree (« recu »), la commande payee, sans litige ni remboursement ;
- montant reverse = prix boutique des articles - commission de la formule gratuite (figee a la commande).
L'admin envoie l'argent hors plateforme (Nita, Amana, Wave, Airtel Money), puis l'enregistre ici.
Les commandes d'avant ce suivi (« legacy ») ne sont jamais comptees : elles ont ete reglees a la main.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import ValidationDomainError
from app.models.order import Order, OrderFulfillment
from app.models.refund import Refund
from app.models.seller_profile import SellerProfile
from app.models.vendor import Vendor

DELIVERED = "recu"


@dataclass
class VendorBalance:
    vendor_id: str
    name: str
    payout_phone: str | None
    to_pay: float = 0.0
    to_pay_gross: float = 0.0
    to_pay_commission: float = 0.0
    orders_to_pay: int = 0
    awaiting_delivery: float = 0.0
    orders_awaiting: int = 0
    paid: float = 0.0
    commission_total: float = 0.0
    lines: list[dict[str, object]] = field(default_factory=list)


def _refunded_order_ids(db: Session, order_ids: set[str]) -> set[str]:
    if not order_ids:
        return set()
    return set(db.scalars(select(Refund.source_id).where(Refund.source == "order", Refund.source_id.in_(list(order_ids)))).all())


def _tracked_rows(db: Session, vendor_id: str | None = None) -> list[OrderFulfillment]:
    query = (
        select(OrderFulfillment)
        .options(selectinload(OrderFulfillment.order))
        .where(OrderFulfillment.payout_status.in_(("pending", "paid")))
        .order_by(OrderFulfillment.updated_at.desc())
    )
    if vendor_id is not None:
        query = query.where(OrderFulfillment.vendor_id == vendor_id)
    return list(db.scalars(query).all())


def _state(row: OrderFulfillment, refunded: set[str]) -> str:
    """« paid » (reverse), « due » (a reverser), « waiting » (pas encore livree / payee), « blocked » (litige, rembourse)."""
    order: Order | None = row.order
    if row.payout_status == "paid":
        return "paid"
    if order is None or order.id in refunded or order.status == "CLAIMED":
        return "blocked"
    if row.status == DELIVERED and order.payment_status == "paid":
        return "due"
    return "waiting"


def _net(row: OrderFulfillment) -> float:
    return round(float(row.vendor_amount or 0) - float(row.commission_amount or 0), 2)


def balances(db: Session, vendor_id: str | None = None, with_lines: bool = False) -> list[VendorBalance]:
    rows = _tracked_rows(db, vendor_id)
    refunded = _refunded_order_ids(db, {r.order_id for r in rows})
    vendor_ids = {r.vendor_id for r in rows} | ({vendor_id} if vendor_id else set())
    profiles = {
        p.vendor_id: p for p in db.scalars(select(SellerProfile).where(SellerProfile.vendor_id.in_(list(vendor_ids)))).all()
    } if vendor_ids else {}
    vendors = {v.id: v for v in db.scalars(select(Vendor).where(Vendor.id.in_(list(vendor_ids)))).all()} if vendor_ids else {}
    out: dict[str, VendorBalance] = {}
    for vid in vendor_ids:
        profile = profiles.get(vid)
        name = (profile.business_name if profile else None) or getattr(vendors.get(vid), "name", None) or "Boutique"
        out[vid] = VendorBalance(vendor_id=vid, name=name, payout_phone=getattr(profile, "payout_phone", None))
    for row in rows:
        bal = out[row.vendor_id]
        state = _state(row, refunded)
        net = _net(row)
        if state == "paid":
            bal.paid += net
            bal.commission_total += float(row.commission_amount or 0)
        elif state == "due":
            bal.to_pay += net
            bal.to_pay_gross += float(row.vendor_amount or 0)
            bal.to_pay_commission += float(row.commission_amount or 0)
            bal.commission_total += float(row.commission_amount or 0)
            bal.orders_to_pay += 1
        elif state == "waiting":
            bal.awaiting_delivery += net
            bal.orders_awaiting += 1
        if with_lines:
            order = row.order
            bal.lines.append(
                {
                    "order_id": row.order_id,
                    "tracking_code": getattr(order, "tracking_code", None),
                    "created_at": order.created_at.isoformat() if order is not None and order.created_at else None,
                    "state": state,
                    "amount": round(float(row.vendor_amount or 0), 2),
                    "commission_rate": float(row.commission_rate or 0),
                    "commission": round(float(row.commission_amount or 0), 2),
                    "net": net,
                    "paid_out_at": row.paid_out_at.isoformat() if row.paid_out_at else None,
                    "payout_reference": row.payout_reference,
                }
            )
    for bal in out.values():
        for attr in ("to_pay", "to_pay_gross", "to_pay_commission", "awaiting_delivery", "paid", "commission_total"):
            setattr(bal, attr, round(getattr(bal, attr), 2))
    return sorted(out.values(), key=lambda b: (b.to_pay, b.awaiting_delivery), reverse=True)


def record_payout(db: Session, vendor_id: str, reference: str | None, now: datetime | None = None) -> tuple[float, int]:
    """Marque comme reversees toutes les parts a reverser de la boutique. Renvoie (montant, nombre de commandes)."""
    rows = _tracked_rows(db, vendor_id)
    refunded = _refunded_order_ids(db, {r.order_id for r in rows})
    due = [r for r in rows if _state(r, refunded) == "due"]
    if not due:
        raise ValidationDomainError("Rien à reverser à cette boutique pour le moment.")
    when = now or datetime.now(UTC)
    clean = (reference or "").strip()[:120] or None
    total = 0.0
    for row in due:
        row.payout_status = "paid"
        row.paid_out_at = when
        row.payout_reference = clean
        total += _net(row)
    return round(total, 2), len(due)
