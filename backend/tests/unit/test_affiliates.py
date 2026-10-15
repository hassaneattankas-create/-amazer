"""Affiliation et ambassadeurs : parrainage, registre des gains, anti-fraude, paiements (base SQLite reelle)."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session

from app.database import Base
from app.models.affiliate import AffiliateAccount, AffiliateEarning, AffiliatePayout, AffiliateReferral
from app.models.global_settings import GlobalSettings
from app.models.order import Order
from app.models.user import User
from app.routes import affiliates as route
from app.services import affiliate_service as svc


@compiles(JSONB, "sqlite")
def _jsonb_on_sqlite(_type, _compiler, **_kw) -> str:
    return "JSON"


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    tables = [User, AffiliateAccount, AffiliateReferral, AffiliateEarning, AffiliatePayout, Order, GlobalSettings]
    Base.metadata.create_all(engine, tables=[t.__table__ for t in tables])
    with Session(engine) as session:
        svc.get_or_create_global_settings(session)
        session.commit()
        yield session


def user(db: Session, uid: str, phone: str | None = None, name: str = "Awa Moussa") -> User:
    row = User(id=uid, email=f"{uid}@test.ne", full_name=name, whatsapp_phone=phone, hashed_password="x", is_active=True)
    db.add(row)
    db.flush()
    return row


def affiliate(db: Session, uid: str = "aff", tier: str = "affiliate", age_days: int = 200, **kw) -> AffiliateAccount:
    user(db, uid, **kw)
    account = svc.ensure_affiliate_account(db, uid)
    account.tier = tier
    account.created_at = datetime.now(UTC) - timedelta(days=age_days)
    db.flush()
    return account


def refer(db: Session, referred: str, code: str, **kw) -> bool:
    user(db, referred, phone=kw.pop("phone", None))
    return svc.record_referral(db, referred, code, **kw)


def mature_now(db: Session) -> None:
    for e in db.scalars(select(AffiliateEarning)).all():
        e.available_at = datetime.now(UTC) - timedelta(seconds=1)
    svc.mature_earnings(db)


def settings(db: Session) -> GlobalSettings:
    return db.scalar(select(GlobalSettings))


# ------------------------------------------------------------- parrainage

def test_code_is_short_and_easy_to_dictate() -> None:
    code = svc._new_code()
    assert len(code) == 6 and not set(code) & set("01OI")


def test_nobody_can_refer_themselves_by_code_or_by_device(db) -> None:
    acc = affiliate(db)
    assert svc.resolve_affiliate(db, acc.code.lower(), "aff") is None
    acc.device_hash = "phone-1"
    assert refer(db, "u1", acc.code, device_hash="phone-1") is False
    assert refer(db, "u2", acc.code, device_hash="phone-2") is True


def test_suspended_affiliate_link_no_longer_works(db) -> None:
    acc = affiliate(db)
    acc.status = "suspended"
    assert refer(db, "u1", acc.code) is False


def test_many_signups_from_same_connection_are_flagged(db) -> None:
    acc = affiliate(db)
    for i in range(3):
        refer(db, f"u{i}", acc.code, ip_hash="ip-1")
    flags = [r.flag for r in db.scalars(select(AffiliateReferral).order_by(AffiliateReferral.referred_user_id))]
    assert flags[:2] == [None, None] and "même connexion" in flags[2]


def test_too_many_signups_per_day_are_flagged(db) -> None:
    acc = affiliate(db)
    settings(db).affiliate_max_referrals_per_day = 2
    for i in range(3):
        refer(db, f"u{i}", acc.code, ip_hash=f"ip-{i}")
    assert db.get(AffiliateReferral, "u2").flag == "trop d'inscriptions en 24 h"


# ------------------------------------------------------------- parts d'abonnement

def test_subscription_share_waits_for_hold_then_becomes_available(db) -> None:
    acc = affiliate(db)
    refer(db, "seller", acc.code)
    earning = svc.credit_subscription_share(db, "seller", 5000, "seller-sub:p1")
    assert (earning.amount, earning.status) == (1000.0, "pending")
    assert svc.credit_subscription_share(db, "seller", 5000, "seller-sub:p1") is None  # une seule fois
    svc.mature_earnings(db)
    assert earning.status == "pending"  # delai de 30 jours pas ecoule
    mature_now(db)
    assert earning.status == "available"


def test_no_share_after_the_period_or_without_referral(db) -> None:
    acc = affiliate(db)
    refer(db, "seller", acc.code)
    db.get(AffiliateReferral, "seller").created_at = datetime.now(UTC) - timedelta(days=400)
    assert svc.credit_subscription_share(db, "seller", 5000, "seller-sub:p2") is None
    user(db, "solo")
    assert svc.credit_subscription_share(db, "solo", 5000, "seller-sub:p3") is None


def test_ambassador_first_month_bonus_applies_to_one_month_only(db) -> None:
    acc = affiliate(db, tier="ambassador")
    refer(db, "seller", acc.code)
    # 3 mois payes d'un coup (15 000) : 50 % d'un mois + 20 % des deux autres = 2500 + 2000
    first = svc.credit_subscription_share(db, "seller", 15000, "seller-sub:a", months=3)
    assert first.amount == 4500.0
    second = svc.credit_subscription_share(db, "seller", 5000, "seller-sub:b")
    assert second.amount == 1000.0


def test_ambassador_tier_rises_with_paying_shops(db) -> None:
    acc = affiliate(db, tier="ambassador")
    s = settings(db)
    s.ambassador_tier2_shops, s.ambassador_tier3_shops = 2, 3
    for i in range(3):
        refer(db, f"s{i}", acc.code)
        svc.credit_subscription_share(db, f"s{i}", 5000, f"seller-sub:first{i}")
    later = svc.credit_subscription_share(db, "s0", 5000, "seller-sub:later")
    assert later.percent == 30.0 and later.amount == 1500.0


def test_new_account_over_monthly_cap_goes_to_review(db) -> None:
    acc = affiliate(db, age_days=10)
    settings(db).affiliate_new_account_monthly_cap = 1500
    refer(db, "seller", acc.code)
    first = svc.credit_subscription_share(db, "seller", 5000, "seller-sub:c1")
    second = svc.credit_subscription_share(db, "seller", 5000, "seller-sub:c2")
    assert first.status == "pending" and second.status == "review"


def test_flagged_referral_and_same_phone_put_earnings_in_review(db) -> None:
    acc = affiliate(db, phone="+22790000001")
    refer(db, "seller", acc.code, phone="90 00 00 01")
    earning = svc.credit_subscription_share(db, "seller", 5000, "seller-sub:d")
    assert earning.status == "review" and "même numéro" in earning.note


def test_suspended_account_earns_nothing(db) -> None:
    acc = affiliate(db)
    refer(db, "seller", acc.code)
    acc.status = "suspended"
    earning = svc.credit_subscription_share(db, "seller", 5000, "seller-sub:e")
    assert earning.status == "cancelled"


# ------------------------------------------------------------- bonus nouveau client

def order(db: Session, oid: str, buyer: str, aff: str | None, status: str = "recu", phone: str | None = None) -> Order:
    row = Order(
        id=oid, user_id=buyer, affiliate_user_id=aff, affiliate_commission=250.0 if aff else 0.0, status=status,
        payment_status="paid", payment_mode="nita", delivery_phone=phone, total_amount=10000,
    )
    db.add(row)
    db.flush()
    return row


def test_new_customer_bonus_only_on_first_order_and_not_from_affiliate_phone(db) -> None:
    acc = affiliate(db)
    user(db, "client")
    assert svc.customer_bonus_for_order(db, "client", acc.code) == ("aff", 250.0)
    acc.device_hash = "phone-aff"
    assert svc.customer_bonus_for_order(db, "client", acc.code, "phone-aff") == (None, 0.0)
    order(db, "o1", "client", "aff")
    assert svc.customer_bonus_for_order(db, "client", acc.code) == (None, 0.0)


def test_bonus_enters_ledger_at_delivery_and_is_cancelled_if_order_cancelled(db) -> None:
    affiliate(db, phone="+22790000009")
    user(db, "client")
    o = order(db, "o1", "client", "aff")
    earning = svc.credit_customer_bonus(db, o)
    assert (earning.kind, earning.status) == ("customer_bonus", "pending")
    assert svc.credit_customer_bonus(db, o) is None
    o.status = "annulee"
    mature_now(db)
    assert earning.status == "cancelled"


def test_bonus_delivered_to_affiliate_phone_is_reviewed(db) -> None:
    affiliate(db, phone="+22790000009")
    user(db, "client")
    earning = svc.credit_customer_bonus(db, order(db, "o1", "client", "aff", phone="90000009"))
    assert earning.status == "review"


# ------------------------------------------------------------- paiements

def funded(db: Session, amount_each: float = 1000, n: int = 3) -> AffiliateAccount:
    acc = affiliate(db)
    for i in range(n):
        db.add(AffiliateEarning(affiliate_user_id="aff", kind="bonus", reference=f"b{i}", amount=amount_each,
                                status="available", available_at=datetime.now(UTC)))
    db.flush()
    return acc


def test_payout_requires_minimum_and_valid_phone(db) -> None:
    funded(db, n=1)
    with pytest.raises(svc.PayoutError, match="minimum"):
        svc.request_payout(db, "aff", "nita", "90000001")
    with pytest.raises(svc.PayoutError, match="invalide"):
        svc.request_payout(db, "aff", "nita", "12")


def test_payout_takes_whole_balance_once_and_paid_needs_reference(db) -> None:
    funded(db)
    payout = svc.request_payout(db, "aff", "amana", "90000001")
    assert payout.amount == 3000.0 and payout.phone == "+22790000001"
    assert {e.status for e in db.scalars(select(AffiliateEarning))} == {"requested"}
    with pytest.raises(svc.PayoutError, match="déjà une demande"):
        svc.request_payout(db, "aff", "amana", "90000001")
    with pytest.raises(svc.PayoutError, match="référence"):
        svc.settle_payout(db, payout, admin_id="admin", paid=True, reference=" ", note=None)
    svc.settle_payout(db, payout, admin_id="admin", paid=True, reference="TX-42", note=None)
    assert payout.status == "paid" and {e.status for e in db.scalars(select(AffiliateEarning))} == {"paid"}
    with pytest.raises(svc.PayoutError):
        svc.settle_payout(db, payout, admin_id="admin", paid=True, reference="TX-43", note=None)


def test_rejected_payout_returns_money_or_cancels_it_for_fraud(db) -> None:
    funded(db)
    p1 = svc.request_payout(db, "aff", "nita", "90000001")
    svc.settle_payout(db, p1, admin_id="admin", paid=False, reference=None, note="numéro faux")
    assert {e.status for e in db.scalars(select(AffiliateEarning))} == {"available"}
    p2 = svc.request_payout(db, "aff", "nita", "90000001")
    svc.settle_payout(db, p2, admin_id="admin", paid=False, reference=None, note="faux comptes", cancel_earnings=True)
    assert {e.status for e in db.scalars(select(AffiliateEarning))} == {"cancelled"}


def test_suspended_affiliate_cannot_request_payout(db) -> None:
    funded(db).status = "suspended"
    with pytest.raises(svc.PayoutError, match="suspendu"):
        svc.request_payout(db, "aff", "nita", "90000001")


def test_admin_can_approve_review_and_cancel_everything_unpaid(db) -> None:
    acc = funded(db)
    flagged = AffiliateEarning(affiliate_user_id="aff", kind="bonus", reference="r", amount=500, status="review",
                               available_at=datetime.now(UTC) - timedelta(days=1))
    db.add(flagged)
    db.flush()
    svc.decide_earning(db, flagged, admin_id="admin", approve=True, note="vérifié")
    assert flagged.status == "available"
    svc.request_payout(db, "aff", "nita", "90000001")
    assert svc.cancel_unpaid(db, acc.user_id, "fraude", "admin") == 4
    assert db.scalar(select(AffiliatePayout.status)) == "rejected"


# ------------------------------------------------------------- soldes, classement, reprise

def test_balances_split_by_status(db) -> None:
    funded(db, n=2)
    db.add(AffiliateEarning(affiliate_user_id="aff", kind="seller_subscription", reference="s", amount=700,
                            status="pending", available_at=datetime.now(UTC) + timedelta(days=5)))
    user(db, "client")
    order(db, "o-wait", "client", "aff", status="preparation")
    result = route.compute_affiliate_earnings(db, "aff")
    assert (result.available, result.on_hold, result.pending, result.earned) == (2000.0, 700.0, 250.0, 2700.0)


def test_leaderboard_ranks_ambassadors_by_new_paying_shops_with_public_names(db) -> None:
    a = affiliate(db, "amb1", tier="ambassador", name="Fatima Issa Moussa")
    b = affiliate(db, "amb2", tier="ambassador", name="Ali")
    refer(db, "s1", a.code)
    refer(db, "s2", b.code)
    refer(db, "s3", b.code)
    for sid in ("s1", "s2", "s3"):
        svc.credit_subscription_share(db, sid, 5000, f"seller-sub:{sid}")
    ranked = svc.monthly_leaderboard(db)
    assert [r[0] for r in ranked] == ["amb2", "amb1"]
    assert route.public_name(db.get(User, "amb1")) == "Fatima I."


def test_backfill_of_old_delivered_bonuses_is_idempotent(db) -> None:
    affiliate(db)
    user(db, "client")
    order(db, "o1", "client", "aff")
    assert svc.backfill_delivered_bonuses(db) == 1
    db.flush()
    assert svc.backfill_delivered_bonuses(db) == 0
