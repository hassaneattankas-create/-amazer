from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy import delete, desc, func, select
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_admin_user
from app.core.exceptions import ValidationDomainError
from app.database import get_db
from app.models.ad_click import AdClick
from app.models.dynamic_section import DynamicSection, DynamicSectionItem
from app.models.product import Price, Product
from app.models.user import User
from app.models.vendor import Vendor
from app.schemas.content import (
    AdClickProductStat,
    AdClickRequest,
    AdClickStatsResponse,
    DynamicSectionCreateRequest,
    DynamicSectionItemRequest,
    DynamicSectionItemResponse,
    DynamicSectionResponse,
    DynamicSectionUpdateRequest,
    HomeContentResponse,
    HomeProductCard,
    HomeRestaurantCard,
    HomeSectionResponse,
)

router = APIRouter(tags=["content"])
admin_router = APIRouter(prefix="/admin/content", tags=["admin-content"])
ads_router = APIRouter(prefix="/ads", tags=["ads"])


def _best_offer_price(product: Product) -> tuple[float, str] | None:
    active = [price for price in product.prices if price.is_active and price.stock_quantity > 0]
    if not active:
        return None
    best = min(active, key=lambda row: row.amount)
    return best.amount, best.currency


def _is_boost_active(product: Product) -> bool:
    if not product.is_boosted:
        return False
    specs = product.specs or {}
    boost_until_raw = specs.get("boost_until")
    if not isinstance(boost_until_raw, str):
        return True
    try:
        parsed = datetime.fromisoformat(boost_until_raw.replace("Z", "+00:00"))
    except ValueError:
        return True
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC) > datetime.now(UTC)


def _to_dynamic_section_response(section: DynamicSection) -> DynamicSectionResponse:
    return DynamicSectionResponse(
        id=section.id,
        title=section.title,
        slug=section.slug,
        section_type=section.section_type,
        is_active=section.is_active,
        sort_order=section.sort_order,
        created_at=section.created_at,
        items=[
            DynamicSectionItemResponse(
                id=item.id,
                target_type=item.target_type,
                product_id=item.product_id,
                vendor_id=item.vendor_id,
                sort_order=item.sort_order,
            )
            for item in sorted(section.items, key=lambda entry: entry.sort_order)
        ],
    )


@admin_router.get("/sections", response_model=list[DynamicSectionResponse])
def list_sections(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_admin_user)],
) -> list[DynamicSectionResponse]:
    sections = db.scalars(
        select(DynamicSection)
        .options(selectinload(DynamicSection.items))
        .order_by(DynamicSection.sort_order.asc(), DynamicSection.created_at.desc())
    ).all()
    return [_to_dynamic_section_response(section) for section in sections]


@admin_router.post("/sections", response_model=DynamicSectionResponse)
def create_section(
    payload: DynamicSectionCreateRequest,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_admin_user)],
) -> DynamicSectionResponse:
    section = DynamicSection(
        title=payload.title,
        slug=payload.slug,
        section_type=payload.section_type,
        is_active=payload.is_active,
        sort_order=payload.sort_order,
    )
    db.add(section)
    db.commit()
    db.refresh(section)
    section = db.scalar(
        select(DynamicSection)
        .where(DynamicSection.id == section.id)
        .options(selectinload(DynamicSection.items))
    )
    assert section is not None
    return _to_dynamic_section_response(section)


@admin_router.put("/sections/{section_id}", response_model=DynamicSectionResponse)
def update_section(
    section_id: str,
    payload: DynamicSectionUpdateRequest,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_admin_user)],
) -> DynamicSectionResponse:
    section = db.scalar(
        select(DynamicSection)
        .where(DynamicSection.id == section_id)
        .options(selectinload(DynamicSection.items))
    )
    if section is None:
        raise ValidationDomainError("Section not found")
    section.title = payload.title
    section.section_type = payload.section_type
    section.is_active = payload.is_active
    section.sort_order = payload.sort_order
    db.commit()
    db.refresh(section)
    return _to_dynamic_section_response(section)


@admin_router.put("/sections/{section_id}/items", response_model=DynamicSectionResponse)
def replace_section_items(
    section_id: str,
    payload: list[DynamicSectionItemRequest],
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_admin_user)],
) -> DynamicSectionResponse:
    section = db.scalar(
        select(DynamicSection)
        .where(DynamicSection.id == section_id)
        .options(selectinload(DynamicSection.items))
    )
    if section is None:
        raise ValidationDomainError("Section not found")
    db.execute(delete(DynamicSectionItem).where(DynamicSectionItem.section_id == section_id))
    for item in payload:
        db.add(
            DynamicSectionItem(
                section_id=section_id,
                target_type=item.target_type,
                product_id=item.product_id,
                vendor_id=item.vendor_id,
                sort_order=item.sort_order,
            )
        )
    db.commit()
    section = db.scalar(
        select(DynamicSection)
        .where(DynamicSection.id == section_id)
        .options(selectinload(DynamicSection.items))
    )
    assert section is not None
    return _to_dynamic_section_response(section)


@admin_router.get("/ad-click-stats", response_model=AdClickStatsResponse)
def ad_click_stats(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_admin_user)],
) -> AdClickStatsResponse:
    total_clicks = db.scalar(select(func.count(AdClick.id))) or 0
    since = datetime.now(UTC) - timedelta(days=7)
    clicks_last_7_days = db.scalar(select(func.count(AdClick.id)).where(AdClick.created_at >= since)) or 0
    rows = db.execute(
        select(AdClick.product_id, func.count(AdClick.id).label("count"))
        .group_by(AdClick.product_id)
        .order_by(desc("count"))
        .limit(20)
    ).all()
    by_product = [AdClickProductStat(product_id=row[0], clicks=int(row[1])) for row in rows]
    return AdClickStatsResponse(
        total_clicks=int(total_clicks),
        clicks_last_7_days=int(clicks_last_7_days),
        by_product=by_product,
    )


@router.get("/home-content", response_model=HomeContentResponse)
def get_home_content(
    db: Annotated[Session, Depends(get_db)],
) -> HomeContentResponse:
    sections = db.scalars(
        select(DynamicSection)
        .where(DynamicSection.is_active.is_(True))
        .options(
            selectinload(DynamicSection.items).selectinload(DynamicSectionItem.product).selectinload(Product.prices),
            selectinload(DynamicSection.items).selectinload(DynamicSectionItem.vendor),
        )
        .order_by(DynamicSection.sort_order.asc(), DynamicSection.created_at.desc())
    ).all()

    banner_candidates = db.scalars(
        select(Product).where(Product.ad_banner_url.is_not(None)).order_by(Product.updated_at.desc()).limit(40)
    ).all()
    top_banner = next((entry.ad_banner_url for entry in banner_candidates if _is_boost_active(entry)), None)

    payload_sections: list[HomeSectionResponse] = []
    for section in sections:
        products: list[HomeProductCard] = []
        restaurants: list[HomeRestaurantCard] = []
        items = sorted(section.items, key=lambda item: item.sort_order)
        for item in items:
            if item.target_type == "product" and item.product is not None:
                price = _best_offer_price(item.product)
                if price is None:
                    continue
                amount, currency = price
                products.append(
                    HomeProductCard(
                        id=item.product.id,
                        name=item.product.name,
                        brand=item.product.brand,
                        main_image_url=item.product.main_image_url,
                        is_sponsored=item.product.is_sponsored,
                        is_boosted=_is_boost_active(item.product),
                        amount=amount,
                        currency=currency,
                    )
                )
            if item.target_type == "restaurant" and item.vendor is not None:
                restaurants.append(
                    HomeRestaurantCard(
                        id=item.vendor.id,
                        name=item.vendor.name,
                        slug=item.vendor.slug,
                    )
                )
        payload_sections.append(
            HomeSectionResponse(
                id=section.id,
                title=section.title,
                slug=section.slug,
                section_type=section.section_type,
                products=products,
                restaurants=restaurants,
            )
        )

    return HomeContentResponse(top_banner_url=top_banner, sections=payload_sections)


@ads_router.post("/click", status_code=200)
def track_ad_click(
    payload: AdClickRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, str]:
    db.add(
        AdClick(
            product_id=payload.product_id,
            section_slug=payload.section_slug,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )
    db.commit()
    return {"status": "ok"}
