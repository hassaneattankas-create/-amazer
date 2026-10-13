"""Moderation : signalements de conversations et visibilite des annonces produit.

Reserve aux administrateurs (controle serveur). L'admin ne lit pas le contenu des
conversations : il dispose du motif, de l'auteur et de la boutique concernee.
"""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.cache import cache_delete_prefixes
from app.core.csrf import enforce_csrf
from app.core.deps import get_admin_user
from app.core.exceptions import NotFoundError
from app.core.rate_limit import client_ip
from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.product import Price, Product
from app.models.seller_profile import SellerProfile
from app.models.user import User
from app.models.vendor import Vendor
from app.services.audit_log_service import append_audit_log
from app.services.notification_service import NotificationPayload, NotificationService

router = APIRouter(prefix="/admin/moderation", tags=["admin-moderation"])


class ConversationReportItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    created_at: datetime
    reporter_email: str | None
    reporter_role: str | None
    reason: str
    conversation_id: str | None
    vendor_id: str | None
    vendor_name: str | None


class ModeratedProductItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    price_id: str
    product_name: str
    vendor_name: str
    amount: float
    stock_quantity: int
    is_active: bool
    hidden_by_admin: bool


class ProductVisibilityRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    visible: bool
    reason: str = Field(default="", max_length=300)


@router.get("/reports", response_model=list[ConversationReportItem])
def list_conversation_reports(
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(get_admin_user)],
    limit: int = Query(default=50, ge=1, le=200),
) -> list[ConversationReportItem]:
    rows = db.scalars(
        select(AuditLog)
        .where(AuditLog.event_type == "conversation_reported")
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    ).all()
    vendor_ids = {str((row.details or {}).get("vendor_id")) for row in rows if (row.details or {}).get("vendor_id")}
    names = (
        {vendor.id: vendor.name for vendor in db.scalars(select(Vendor).where(Vendor.id.in_(vendor_ids))).all()}
        if vendor_ids
        else {}
    )
    items: list[ConversationReportItem] = []
    for row in rows:
        details = row.details or {}
        vendor_id = details.get("vendor_id")
        items.append(
            ConversationReportItem(
                id=row.id,
                created_at=row.created_at,
                reporter_email=row.actor_email,
                reporter_role=details.get("role"),
                reason=str(details.get("reason") or ""),
                conversation_id=row.entity_id,
                vendor_id=vendor_id,
                vendor_name=names.get(vendor_id) if vendor_id else None,
            )
        )
    return items


def _product_item(price: Price) -> ModeratedProductItem:
    return ModeratedProductItem(
        price_id=price.id,
        product_name=price.product.name if price.product else "Produit",
        vendor_name=price.vendor.name if price.vendor else "Boutique",
        amount=float(price.amount),
        stock_quantity=int(price.stock_quantity),
        is_active=bool(price.is_active),
        hidden_by_admin=bool(price.hidden_by_admin),
    )


@router.get("/products", response_model=list[ModeratedProductItem])
def search_products(
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(get_admin_user)],
    query: str = Query(default="", max_length=120),
    hidden_only: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[ModeratedProductItem]:
    statement = (
        select(Price)
        .join(Product, Product.id == Price.product_id)
        .options(selectinload(Price.product), selectinload(Price.vendor))
        .order_by(Product.name.asc())
        .limit(limit)
    )
    if query.strip():
        statement = statement.where(Product.name.ilike(f"%{query.strip()}%"))
    if hidden_only:
        statement = statement.where(Price.hidden_by_admin.is_(True))
    return [_product_item(price) for price in db.scalars(statement).all()]


@router.post("/products/{price_id}/visibility", response_model=ModeratedProductItem)
def set_product_visibility(
    price_id: str,
    payload: ProductVisibilityRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    admin_user: Annotated[User, Depends(get_admin_user)],
) -> ModeratedProductItem:
    """Masque (ou reaffiche) une annonce ; le vendeur est prevenu du masquage."""
    enforce_csrf(request)
    price = db.get(Price, price_id)
    if price is None:
        raise NotFoundError("Annonce introuvable")
    price.hidden_by_admin = not payload.visible
    price.is_active = payload.visible
    append_audit_log(
        db,
        event_type="admin_product_visibility_changed",
        actor=admin_user,
        ip_address=client_ip(request),
        path=str(request.url.path),
        entity_type="price",
        entity_id=price.id,
        details={"visible": payload.visible, "reason": payload.reason},
    )
    db.commit()
    db.refresh(price)
    cache_delete_prefixes("catalog:", "content:")

    if not payload.visible:
        seller_user_id = db.scalar(select(SellerProfile.user_id).where(SellerProfile.vendor_id == price.vendor_id))
        if seller_user_id:
            try:
                NotificationService(db).send_to_user(
                    user_id=seller_user_id,
                    payload=NotificationPayload(
                        title="Produit masque par la moderation",
                        body=(
                            f"« {price.product.name if price.product else 'Votre produit'} » n'est plus visible."
                            + (f" Motif : {payload.reason}" if payload.reason else "")
                        )[:180],
                        data={"tag": f"moderation-{price.id}", "href": "/seller/dashboard", "kind": "moderation"},
                    ),
                )
                db.commit()
            except Exception:  # pragma: no cover - la notification ne doit pas annuler la moderation
                db.rollback()
    return _product_item(price)
