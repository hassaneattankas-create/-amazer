"""Promotions vendeur : prix promo pour une duree choisie, puis retour automatique au prix normal.

Stockage (inchange, lu par le catalogue et les cartes produit) dans product.specs :
  original_price -> prix normal, promo_price -> prix promo, promo_until -> fin (ISO, UTC).
Pendant la promo, price.amount = prix promo (c'est le prix facture).
"""

import logging
import threading
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import ValidationDomainError
from app.models.product import Price, Product

logger = logging.getLogger(__name__)

PROMO_KEYS = ("promo_price", "promo_until", "original_price")
DEFAULT_PROMO_DAYS = 7
MAX_PROMO_DAYS = 60


def _until(specs: dict) -> datetime | None:
    raw = specs.get("promo_until")
    if not isinstance(raw, str):
        return None
    try:
        value = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def promo_active(specs: dict, now: datetime | None = None) -> bool:
    until = _until(specs)
    return isinstance(specs.get("promo_price"), (int, float)) and until is not None and until > (now or datetime.now(UTC))


def normal_price(price: Price) -> float:
    """Prix hors promo : le prix d'origine memorise si une promo a ete posee, sinon le prix courant."""
    specs = price.product.specs or {}
    original = specs.get("original_price")
    if any(key in specs for key in ("promo_price", "promo_until")) and isinstance(original, (int, float)) and original > 0:
        return float(original)
    return float(price.amount)


def end_promo(price: Price) -> bool:
    """Retire la promo et remet le prix normal. Retourne True si quelque chose a change."""
    specs = dict(price.product.specs or {})
    if not any(key in specs for key in PROMO_KEYS):
        return False
    price.amount = normal_price(price)
    for key in PROMO_KEYS:
        specs.pop(key, None)
    price.product.specs = specs
    return True


def apply_price_and_promo(
    price: Price,
    *,
    amount: float | None,
    promo_amount: float | None,
    promo_days: int | None,
    clear_promo: bool,
    now: datetime | None = None,
) -> None:
    """Met a jour le prix normal et/ou la promo d'une offre (« amount » = toujours le prix normal)."""
    now = now or datetime.now(UTC)
    normal = float(amount) if amount is not None else normal_price(price)
    specs = dict(price.product.specs or {})
    running = promo_active(specs, now)

    if clear_promo or (promo_amount is None and not running):
        end_promo(price)
        price.amount = normal
        return
    if promo_amount is None:
        # Promo en cours conservee ; seul le prix normal change.
        if normal <= float(specs["promo_price"]):
            end_promo(price)
            price.amount = normal
            return
        specs["original_price"] = normal
        price.product.specs = specs
        return
    if float(promo_amount) >= normal:
        raise ValidationDomainError(f"Le prix promo doit être inférieur au prix normal ({int(normal)} F).")
    days = min(max(int(promo_days or DEFAULT_PROMO_DAYS), 1), MAX_PROMO_DAYS)
    # Meme promo deja en cours et pas de nouvelle duree : on garde la date de fin.
    keep_end = running and promo_days is None and float(specs.get("promo_price") or 0) == float(promo_amount)
    specs["original_price"] = normal
    specs["promo_price"] = float(promo_amount)
    if not keep_end:
        specs["promo_until"] = (now + timedelta(days=days)).isoformat()
    price.product.specs = specs
    price.amount = float(promo_amount)


def expire_promotions(db: Session, now: datetime | None = None) -> int:
    """Promos terminees : retour au prix normal (et plus d'affichage « promo »)."""
    now = now or datetime.now(UTC)
    rows = db.scalars(select(Price).join(Product, Product.id == Price.product_id).where(Product.specs.has_key("promo_until"))).all()
    ended = 0
    for price in rows:
        until = _until(price.product.specs or {})
        if until is None or until <= now:
            if end_promo(price):
                ended += 1
    return ended


def _run_expiry_once() -> None:
    from app.core.cache import cache_delete_prefixes
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        ended = expire_promotions(db)
        db.commit()
        if ended:
            cache_delete_prefixes("catalog:")
            logger.info("Promotions terminees : %s prix remis au prix normal.", ended)
    except Exception:  # noqa: BLE001 - ne doit jamais arreter le serveur
        db.rollback()
        logger.exception("Fin automatique des promotions impossible.")
    finally:
        db.close()


_started = False


def start_promo_expiry_worker(interval_seconds: int = 15 * 60) -> None:
    """Toutes les 15 minutes, termine les promos echues (un seul fil par processus)."""
    global _started
    if _started:
        return
    _started = True
    stop = threading.Event()

    def loop() -> None:
        while not stop.is_set():
            _run_expiry_once()
            stop.wait(interval_seconds)

    threading.Thread(target=loop, name="promo-expiry", daemon=True).start()
