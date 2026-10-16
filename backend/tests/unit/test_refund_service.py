"""Remboursements : inscrits une seule fois par commande, reference obligatoire pour cloturer."""

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.database import Base
from app.models.refund import Refund
from app.services import refund_service as svc


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine, tables=[Refund.__table__])
    with Session(engine) as session:
        yield session


def add(db: Session, amount: float = 5200, source_id: str = "o1"):
    return svc.record_refund(
        db, source="restaurant_order", source_id=source_id, user_id="u1", customer_name="Moussa",
        phone="+22790000002", method="nita", amount=amount, reason="Commande refusée par le restaurant",
    )


def test_refund_is_recorded_once_per_order(db) -> None:
    first = add(db)
    second = add(db)
    assert first is not None and first.id == second.id
    assert db.scalar(select(Refund.status)) == "to_refund"
    assert len(db.scalars(select(Refund)).all()) == 1


def test_nothing_to_refund_for_free_orders(db) -> None:
    assert add(db, amount=0, source_id="o2") is None


def test_closing_a_refund_needs_the_transfer_reference(db) -> None:
    refund = add(db)
    with pytest.raises(ValueError, match="référence"):
        svc.settle_refund(refund, admin_id="admin", refunded=True, reference=" ", note=None)
    svc.settle_refund(refund, admin_id="admin", refunded=True, reference="NT998877", note=None)
    assert (refund.status, refund.reference) == ("refunded", "NT998877")
    with pytest.raises(ValueError, match="déjà"):
        svc.settle_refund(refund, admin_id="admin", refunded=False, reference=None, note=None)
