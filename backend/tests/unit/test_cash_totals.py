"""Caisse de l'admin : seules les commandes payées et non annulées comptent (base SQLite réelle)."""

from sqlalchemy import create_engine, func, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session
from sqlalchemy.schema import CreateIndex

from app.database import Base
from app.models.order import Order
from app.models.user import User
from app.routes.admin_finance import _in_cash


@compiles(JSONB, "sqlite")
def _jsonb_on_sqlite(_type, _compiler, **_kw) -> str:
    return "JSON"


@compiles(CreateIndex, "sqlite")
def _skip_postgres_only_index(create, compiler, **kw) -> str:
    if create.element.name == "ix_products_search_tsv":
        return "SELECT 1"
    return compiler.visit_create_index(create, **kw)


def test_cancelled_and_unpaid_orders_leave_the_cash() -> None:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine, tables=[User.__table__, Order.__table__])
    with Session(engine) as db:
        db.add(User(id="client", email="client@test.ne", full_name="Client", hashed_password="x", is_active=True))
        db.add_all(
            [
                Order(user_id="client", status="livraison", payment_status="paid", total_amount=10000, payment_mode="nita"),
                # Faux paiement : commande annulée par AMAZER
                Order(user_id="client", status="annulee", payment_status="paid", total_amount=50000, payment_mode="nita"),
                # Fausse commande jamais payée, annulée
                Order(user_id="client", status="annulee", payment_status="pending", total_amount=70000, payment_mode="amana"),
                # Paiement en attente de vérification : pas encore en caisse
                Order(user_id="client", status="commande", payment_status="pending", total_amount=3000, payment_mode="amana"),
            ]
        )
        db.commit()
        rows = dict(db.execute(select(Order.payment_mode, func.sum(Order.total_amount)).where(*_in_cash(Order)).group_by(Order.payment_mode)).all())
        assert {k: float(v) for k, v in rows.items()} == {"nita": 10000.0}
