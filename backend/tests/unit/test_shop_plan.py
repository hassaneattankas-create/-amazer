"""Formule gratuite des boutiques et reversements (base SQLite reelle)."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.schema import CreateIndex
from sqlalchemy.orm import Session

from app.core.exceptions import ValidationDomainError
from app.database import Base
from app.models.global_settings import GlobalSettings
from app.models.order import Order, OrderFulfillment, OrderItem
from app.models.product import Price, Product
from app.models.refund import Refund
from app.models.seller_profile import SellerProfile
from app.models.seller_subscription_payment import SellerSubscriptionPayment
from app.models.user import User
from app.models.vendor import Vendor
from app.repositories.catalog_repository import active_subscription_clause
from app.services import shop_plan_service as plan
from app.services import vendor_payout_service as payouts
from app.services.order_fulfillment_service import create_initial_fulfillments
from app.services.vendor_visibility import reactivate_vendor_listings


@compiles(JSONB, "sqlite")
def _jsonb_on_sqlite(_type, _compiler, **_kw) -> str:
    return "JSON"


@compiles(CreateIndex, "sqlite")
def _skip_postgres_only_index(create, compiler, **kw) -> str:
    """L'index de recherche plein texte des produits n'existe que sous PostgreSQL."""
    if create.element.name == "ix_products_search_tsv":
        return "SELECT 1"
    return compiler.visit_create_index(create, **kw)


TABLES = (User, Vendor, SellerProfile, GlobalSettings, Product, Price, Order, OrderItem, OrderFulfillment, Refund, SellerSubscriptionPayment)
NOW = datetime.now(UTC)


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine, tables=[t.__table__ for t in TABLES])
    with Session(engine) as session:
        session.add(GlobalSettings())
        session.commit()
        yield session


def seller(db: Session, uid: str, *, kind: str = "shop", tier: str = "basic", paid_days: int | None = 10) -> SellerProfile:
    db.add(User(id=uid, email=f"{uid}@test.ne", full_name=uid, hashed_password="x", is_active=True))
    db.add(Vendor(id=f"v-{uid}", name=uid, slug=f"s-{uid}", is_active=True))
    profile = SellerProfile(
        user_id=uid, vendor_id=f"v-{uid}", business_name=uid.title(), city="Niamey", activity_type=kind, storefront_tier=tier,
        onboarding_fee_paid_at=NOW - timedelta(days=30),
        subscription_paid_until=None if paid_days is None else NOW + timedelta(days=paid_days),
    )
    db.add(profile)
    db.commit()
    return profile


def products(db: Session, profile: SellerProfile, count: int, *, active: bool = True) -> list[Price]:
    rows = []
    for index in range(count):
        product = Product(name=f"P{index}", brand="B", specs={})
        db.add(product)
        db.flush()
        price = Price(product_id=product.id, vendor_id=profile.vendor_id, currency="XOF", amount=1000, stock_quantity=5, is_active=active,
                      updated_at=NOW - timedelta(minutes=count - index))
        db.add(price)
        rows.append(price)
    db.commit()
    return rows


def order_for(db: Session, profile: SellerProfile, amount: float = 10_000, *, status: str = "commande", paid: str = "paid") -> Order:
    order = Order(user_id="client", status=status, payment_status=paid, total_amount=amount, payment_mode="nita")
    product = Product(name="Vendu", brand="B", specs={})
    db.add(product)
    db.flush()
    order.items = [OrderItem(product_id=product.id, vendor_id=profile.vendor_id, quantity=2, unit_price=amount / 2)]
    create_initial_fulfillments(order)
    plan.price_fulfillments(db, order)
    db.add(order)
    db.commit()
    return order


def deliver(db: Session, order: Order) -> None:
    order.status = "recu"
    for row in order.fulfillments:
        row.status = "recu"
    db.commit()


# ---------------------------------------------------------------- formule

def test_trial_or_subscription_is_not_free_plan_and_takes_no_commission(db: Session) -> None:
    shop = seller(db, "awa")
    assert plan.has_paid_access(shop) and not plan.is_free_plan(shop) and plan.can_operate(shop)
    assert plan.commission_rate_for(db, shop) == 0.0


def test_expired_shop_moves_to_free_plan_and_stays_visible(db: Session) -> None:
    shop = seller(db, "bella", paid_days=-1)
    assert plan.is_free_plan(shop) and plan.can_operate(shop)
    assert plan.commission_rate_for(db, shop) == pytest.approx(0.05)
    visible_ids = set(db.scalars(select(SellerProfile.id).join(Vendor, Vendor.id == SellerProfile.vendor_id).where(active_subscription_clause())).all())
    assert shop.id in visible_ids


def test_restaurant_and_premium_keep_subscription_only(db: Session) -> None:
    resto = seller(db, "chezawa", kind="restaurant", paid_days=-1)
    premium = seller(db, "hotel", tier="premium", paid_days=-1)
    for profile in (resto, premium):
        assert not plan.is_free_plan(profile) and not plan.can_operate(profile)
    visible_ids = set(db.scalars(select(SellerProfile.id).where(active_subscription_clause())).all())
    assert resto.id not in visible_ids and premium.id not in visible_ids


def test_free_plan_keeps_five_most_recent_products_and_never_deletes(db: Session) -> None:
    shop = seller(db, "mode", paid_days=-1)
    rows = products(db, shop, 7)
    hidden, restored = plan.apply_free_plan(db, shop)
    db.commit()
    assert (hidden, restored) == (2, 0)
    assert plan.visible_count(db, shop.vendor_id) == 5
    assert all(not p.is_active for p in rows[:2]) and all(p.is_active for p in rows[2:])
    assert db.scalar(select(Price).where(Price.id == rows[0].id)) is not None  # mis de cote, pas supprime
    # Abonnement repris : tout revient.
    assert reactivate_vendor_listings(db, shop.vendor_id) == 2


def test_free_plan_refills_up_to_five_but_never_reshows_a_paused_product(db: Session) -> None:
    shop = seller(db, "deco", paid_days=-1)
    rows = products(db, shop, 7, active=False)  # boutique masquee par l'ancien systeme
    rows[6].product.specs = {"seller_paused": True}
    rows[5].hidden_by_admin = True
    db.commit()
    db.get(Vendor, shop.vendor_id).is_active = False
    db.commit()
    hidden, restored = plan.apply_free_plan(db, shop)
    db.commit()
    assert (hidden, restored) == (0, 5)
    assert db.get(Vendor, shop.vendor_id).is_active is True
    assert not rows[6].is_active and not rows[5].is_active


def test_free_plan_refuses_a_sixth_visible_product(db: Session) -> None:
    shop = seller(db, "tech", paid_days=-1)
    products(db, shop, 5)
    with pytest.raises(ValidationDomainError, match="5 produits visibles"):
        plan.ensure_free_slot(db, shop)
    subscribed = seller(db, "pro")
    products(db, subscribed, 9)
    plan.ensure_free_slot(db, subscribed)  # abonne : pas de limite de la formule gratuite


# ---------------------------------------------------------------- commission et reversements

def test_order_freezes_vendor_share_and_free_plan_commission(db: Session) -> None:
    free = seller(db, "libre", paid_days=-1)
    paid = seller(db, "abonne")
    row_free = order_for(db, free, 10_000).fulfillments[0]
    row_paid = order_for(db, paid, 10_000).fulfillments[0]
    assert (row_free.vendor_amount, row_free.commission_rate, row_free.commission_amount, row_free.payout_status) == (10_000, 0.05, 500, "pending")
    assert (row_paid.commission_rate, row_paid.commission_amount) == (0.0, 0.0)


def test_payout_due_only_after_delivery_and_payment_then_recorded_once(db: Session) -> None:
    shop = seller(db, "vente", paid_days=-1)
    order = order_for(db, shop, 10_000)
    unpaid = order_for(db, shop, 4_000, paid="pending")
    bal = payouts.balances(db, vendor_id=shop.vendor_id)[0]
    assert (bal.to_pay, bal.orders_awaiting, bal.awaiting_delivery) == (0, 2, 13_300)
    with pytest.raises(ValidationDomainError, match="Rien à reverser"):
        payouts.record_payout(db, shop.vendor_id, None)

    deliver(db, order)
    deliver(db, unpaid)  # livree mais pas payee : pas encore due
    bal = payouts.balances(db, vendor_id=shop.vendor_id)[0]
    assert (bal.to_pay, bal.to_pay_commission, bal.orders_to_pay) == (9_500, 500, 1)

    amount, count = payouts.record_payout(db, shop.vendor_id, "NT-123")
    db.commit()
    assert (amount, count) == (9_500, 1)
    bal = payouts.balances(db, vendor_id=shop.vendor_id)[0]
    assert (bal.to_pay, bal.paid) == (0, 9_500)
    with pytest.raises(ValidationDomainError):
        payouts.record_payout(db, shop.vendor_id, "NT-124")  # jamais deux fois


def test_claims_refunds_and_old_orders_are_never_paid_out(db: Session) -> None:
    shop = seller(db, "litige", paid_days=-1)
    claimed = order_for(db, shop, 2_000)
    deliver(db, claimed)
    claimed.status = "CLAIMED"
    refunded = order_for(db, shop, 2_000)
    deliver(db, refunded)
    db.add(Refund(source="order", source_id=refunded.id, customer_name="Client", amount=2_000, reason="Article manquant"))
    old = order_for(db, shop, 2_000)
    deliver(db, old)
    old.fulfillments[0].payout_status = "legacy"
    db.commit()
    bal = payouts.balances(db, vendor_id=shop.vendor_id)[0]
    assert bal.to_pay == 0 and bal.orders_to_pay == 0


# ---------------------------------------------------------------- message de formule

def test_each_seller_sees_its_kind_and_trial(db: Session, monkeypatch) -> None:
    import app.services.seller_profile_service as sps

    monkeypatch.setattr(sps, "resolve_trial_days", lambda _db: 14)
    shop = seller(db, "essai", paid_days=None)
    shop.onboarding_fee_paid_at = NOW
    shop.subscription_paid_until = NOW + timedelta(days=14)
    resto = seller(db, "resto", kind="restaurant")
    hotel = seller(db, "hotel", kind="hotel", tier="premium")
    pharma = seller(db, "pharma", tier="premium")
    pharma.service_kind = "pharmacy"
    db.commit()
    assert [plan.seller_kind(p) for p in (shop, resto, hotel, pharma)] == ["shop", "restaurant", "premium", "pharmacy"]
    assert plan.in_trial(db, shop) is True
    # Abonnement de 30 jours accorde par l'admin (resto cree avec 10 jours mais demarre il y a 30) : pas un essai.
    resto.subscription_paid_until = NOW + timedelta(days=30)
    db.commit()
    assert plan.in_trial(db, resto) is False
    # Paiement valide : ce n'est plus un essai.
    db.add(SellerSubscriptionPayment(seller_profile_id=shop.id, seller_user_id=shop.user_id, payment_mode="nita",
                                     transaction_reference="NT-1", months=1, amount_claimed=2000, status="approved"))
    db.commit()
    assert plan.in_trial(db, shop) is False
    summary = plan.plan_summary(db, shop)
    assert summary["kind"] == "shop" and summary["monthly_fee"] > 0
