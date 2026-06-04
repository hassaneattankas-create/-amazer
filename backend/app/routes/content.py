from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy import delete, desc, func, select
from sqlalchemy.orm import Session, selectinload

from app.core.cache import build_cache_key, cache_get_json, cache_set_json
from app.core.csrf import enforce_csrf
from app.core.deps import get_admin_user
from app.core.exceptions import ValidationDomainError
from app.database import get_db
from app.models.ad_click import AdClick
from app.models.category import Category
from app.models.dynamic_section import DynamicSection, DynamicSectionItem
from app.models.global_settings import GlobalSettings
from app.models.product import Price, Product
from app.models.seller_profile import SellerProfile
from app.models.user import User
from app.models.vendor import Vendor
from app.schemas.content import (
    AdClickProductStat,
    AdClickRequest,
    AdClickStatsResponse,
    AdminCategoryCreateRequest,
    AdminCategoryResponse,
    AdminCategoryUpdateRequest,
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
from app.services.public_catalog_policy import (
    is_allowed_public_home_brand,
    is_allowed_public_restaurant_name,
)

router = APIRouter(tags=["content"])
admin_router = APIRouter(prefix="/admin/content", tags=["admin-content"])
ads_router = APIRouter(prefix="/ads", tags=["ads"])


def _best_offer_price(product: Product) -> tuple[float, str] | None:
    active = [
        price
        for price in product.prices
        if price.is_active and price.stock_quantity > 0 and _is_vendor_publicly_visible(price.vendor)
    ]
    if not active:
        return None
    best = min(active, key=lambda row: row.amount)
    return best.amount, best.currency


def _is_vendor_publicly_visible(vendor: Vendor | None) -> bool:
    if vendor is None or not vendor.is_active:
        return False
    profile = getattr(vendor, "seller_profile", None)
    owner = getattr(profile, "user", None)
    if owner is not None and not owner.is_active:
        return False
    return True


def _build_fallback_home_sections(db: Session) -> list[HomeSectionResponse]:
    product_candidates = db.scalars(
        select(Product)
        .options(
            selectinload(Product.prices)
            .selectinload(Price.vendor)
            .selectinload(Vendor.seller_profile)
            .selectinload(SellerProfile.user)
        )
        .order_by(Product.updated_at.desc())
        .limit(60)
    ).all()

    fallback_products: list[HomeProductCard] = []
    for product in product_candidates:
        if not is_allowed_public_home_brand(product.brand):
            continue
        price = _best_offer_price(product)
        if price is None:
            continue
        amount, currency = price
        fallback_products.append(
            HomeProductCard(
                id=product.id,
                name=product.name,
                brand=product.brand,
                main_image_url=product.main_image_url,
                is_sponsored=False,
                is_boosted=False,
                amount=amount,
                currency=currency,
            )
        )
        if len(fallback_products) >= 12:
            break

    restaurant_candidates = db.scalars(
        select(Vendor)
        .join(Vendor.seller_profile)
        .options(
            selectinload(Vendor.seller_profile).selectinload(SellerProfile.user),
        )
        .where(Vendor.is_active.is_(True))
        .order_by(Vendor.updated_at.desc())
        .limit(40)
    ).all()

    fallback_restaurants: list[HomeRestaurantCard] = []
    seen_restaurant_ids: set[str] = set()
    for vendor in restaurant_candidates:
        profile = vendor.seller_profile
        if profile is None or profile.activity_type != "restaurant":
            continue
        if not _is_vendor_publicly_visible(vendor):
            continue
        preferred_name = profile.business_name or vendor.name
        if not is_allowed_public_restaurant_name(preferred_name):
            continue
        if vendor.id in seen_restaurant_ids:
            continue
        fallback_restaurants.append(
            HomeRestaurantCard(
                id=vendor.id,
                name=vendor.name,
                slug=vendor.slug,
            )
        )
        seen_restaurant_ids.add(vendor.id)
        if len(fallback_restaurants) >= 6:
            break

    sections: list[HomeSectionResponse] = []
    if fallback_products:
        sections.append(
            HomeSectionResponse(
                id="fallback-products",
                title="Offres du moment",
                slug="fallback-products",
                section_type="products",
                products=fallback_products,
                restaurants=[],
            )
        )
    if fallback_restaurants:
        sections.append(
            HomeSectionResponse(
                id="fallback-restaurants",
                title="Restaurants en vue",
                slug="fallback-restaurants",
                section_type="restaurants",
                products=[],
                restaurants=fallback_restaurants,
            )
        )
    return sections


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


def _to_category_response(category: Category) -> AdminCategoryResponse:
    return AdminCategoryResponse(
        id=category.id,
        name=category.name,
        slug=category.slug,
        parent_id=category.parent_id,
        is_active=category.is_active,
        created_at=category.created_at,
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


@admin_router.get("/categories", response_model=list[AdminCategoryResponse])
def list_categories_admin(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_admin_user)],
) -> list[AdminCategoryResponse]:
    rows = db.scalars(select(Category).order_by(Category.name.asc())).all()
    return [_to_category_response(row) for row in rows]


@admin_router.post("/categories", response_model=AdminCategoryResponse)
def create_category_admin(
    payload: AdminCategoryCreateRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_admin_user)],
) -> AdminCategoryResponse:
    enforce_csrf(request)
    exists = db.scalar(select(Category.id).where(Category.slug == payload.slug))
    if exists:
        raise ValidationDomainError("Category slug already exists")
    row = Category(
        name=payload.name,
        slug=payload.slug,
        parent_id=payload.parent_id,
        is_active=payload.is_active,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_category_response(row)


@admin_router.put("/categories/{category_id}", response_model=AdminCategoryResponse)
def update_category_admin(
    category_id: str,
    payload: AdminCategoryUpdateRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_admin_user)],
) -> AdminCategoryResponse:
    enforce_csrf(request)
    row = db.get(Category, category_id)
    if row is None:
        raise ValidationDomainError("Category not found")
    exists = db.scalar(
        select(Category.id).where(Category.slug == payload.slug).where(Category.id != category_id)
    )
    if exists:
        raise ValidationDomainError("Category slug already exists")
    row.name = payload.name
    row.slug = payload.slug
    row.parent_id = payload.parent_id
    row.is_active = payload.is_active
    db.commit()
    db.refresh(row)
    return _to_category_response(row)


@admin_router.post("/sections", response_model=DynamicSectionResponse)
def create_section(
    payload: DynamicSectionCreateRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_admin_user)],
) -> DynamicSectionResponse:
    enforce_csrf(request)
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
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_admin_user)],
) -> DynamicSectionResponse:
    enforce_csrf(request)
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
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_admin_user)],
) -> DynamicSectionResponse:
    enforce_csrf(request)
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
    settings_row = db.scalar(select(GlobalSettings).order_by(GlobalSettings.id.asc()))
    reset_at = settings_row.ad_click_counters_reset_at if settings_row is not None else None
    total_clicks_query = select(func.count(AdClick.id))
    if reset_at is not None:
        total_clicks_query = total_clicks_query.where(AdClick.created_at >= reset_at)
    total_clicks = db.scalar(total_clicks_query) or 0
    since = datetime.now(UTC) - timedelta(days=7)
    effective_since = max(since, reset_at) if reset_at is not None else since
    clicks_last_7_days = (
        db.scalar(select(func.count(AdClick.id)).where(AdClick.created_at >= effective_since)) or 0
    )
    rows_query = select(AdClick.product_id, func.count(AdClick.id).label("count"))
    if reset_at is not None:
        rows_query = rows_query.where(AdClick.created_at >= reset_at)
    rows = db.execute(
        rows_query.group_by(AdClick.product_id).order_by(desc("count")).limit(20)
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
    cache_key = build_cache_key("content:home")
    cached = cache_get_json(cache_key)
    if cached is not None:
        return HomeContentResponse(**cached)
    sections = db.scalars(
        select(DynamicSection)
        .where(DynamicSection.is_active.is_(True))
        .options(
            selectinload(DynamicSection.items)
            .selectinload(DynamicSectionItem.product)
            .selectinload(Product.prices)
            .selectinload(Price.vendor)
            .selectinload(Vendor.seller_profile)
            .selectinload(SellerProfile.user),
            selectinload(DynamicSection.items)
            .selectinload(DynamicSectionItem.vendor)
            .selectinload(Vendor.seller_profile)
            .selectinload(SellerProfile.user),
        )
        .order_by(DynamicSection.sort_order.asc(), DynamicSection.created_at.desc())
    ).all()

    banner_candidates = db.scalars(
        select(Product)
        .where(Product.ad_banner_url.is_not(None))
        .options(
            selectinload(Product.prices)
            .selectinload(Price.vendor)
            .selectinload(Vendor.seller_profile)
            .selectinload(SellerProfile.user)
        )
        .order_by(Product.updated_at.desc())
        .limit(40)
    ).all()
    top_banner = next(
        (entry.ad_banner_url for entry in banner_candidates if _best_offer_price(entry) is not None),
        None,
    )

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
                        is_sponsored=False,
                        is_boosted=False,
                        amount=amount,
                        currency=currency,
                    )
                )
                if not is_allowed_public_home_brand(item.product.brand):
                    products.pop()
            if item.target_type == "restaurant" and item.vendor is not None and _is_vendor_publicly_visible(item.vendor):
                if is_allowed_public_restaurant_name(item.vendor.name):
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

    if not any(section.products or section.restaurants for section in payload_sections):
        payload_sections = _build_fallback_home_sections(db)

    response = HomeContentResponse(top_banner_url=top_banner, sections=payload_sections)
    cache_set_json(cache_key, response.model_dump(), ttl_seconds=60)
    return response


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
