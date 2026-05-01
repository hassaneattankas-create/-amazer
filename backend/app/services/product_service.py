from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.models.product import Price, Product
from app.repositories.product_repository import ProductRepository, SearchOfferRow
from app.schemas.product import (
    CategoryResponse,
    OfferResponse,
    PriceHistoryPointResponse,
    ProductDetailResponse,
    ProductImageResponse,
    ProductSearchMeta,
    ProductSearchResponse,
    ProductSearchResult,
    RankingBreakdownResponse,
    SearchSort,
    VendorResponse,
)
from app.services.ranking_service import RankingBreakdown, RankingService
from app.services.public_catalog_policy import (
    is_allowed_public_home_brand,
    is_allowed_public_product_offer,
    product_seed_source,
)


@dataclass(frozen=True)
class RankedOffer:
    row: SearchOfferRow
    ranking: RankingBreakdown


class ProductService:
    def __init__(self, db: Session) -> None:
        self.products = ProductRepository(db)
        self.ranking = RankingService()

    def search_products(
        self,
        *,
        query: str | None,
        barcode: str | None = None,
        brand: str | None,
        category_id: str | None,
        category_slug: str | None,
        spec_key: str | None,
        spec_value: str | None,
        min_price: float | None,
        max_price: float | None,
        in_stock_only: bool,
        sort: SearchSort,
        limit: int,
        offset: int,
    ) -> ProductSearchResult:
        target = max(limit + offset, limit)
        # Cap prefetch: loading 5x rows with full product graphs was very slow on large catalogs.
        raw_limit = min(max(target * 3, target + 24), 160)
        rows = self.products.search_offers(
            query=query,
            barcode=barcode,
            brand=brand,
            category_id=category_id,
            category_slug=category_slug,
            spec_key=spec_key,
            spec_value=spec_value,
            min_price=min_price,
            max_price=max_price,
            in_stock_only=in_stock_only,
            raw_limit=raw_limit,
            raw_offset=0,
        )
        if not rows:
            return ProductSearchResult(
                items=[],
                meta=ProductSearchMeta(limit=limit, offset=offset, returned=0),
            )

        amounts = [row.price.amount for row in rows]
        min_amount = min(amounts)
        max_amount = max(amounts)

        ranked = [
            RankedOffer(
                row=row,
                ranking=self.ranking.score_offer(
                    amount=row.price.amount,
                    min_amount=min_amount,
                    max_amount=max_amount,
                    stock_quantity=row.price.stock_quantity,
                    text_relevance=row.text_rank,
                    vendor_is_active=row.price.vendor.is_active,
                ),
            )
            for row in rows
            if self._is_public_offer_allowed(row)
        ]
        if not ranked:
            return ProductSearchResult(
                items=[],
                meta=ProductSearchMeta(limit=limit, offset=offset, returned=0),
            )

        best_by_product: dict[str, RankedOffer] = {}
        for offer in ranked:
            product_id = offer.row.product.id
            current = best_by_product.get(product_id)
            if current is None or self._is_better(offer, current, sort):
                best_by_product[product_id] = offer

        sorted_products = sorted(
            best_by_product.values(),
            key=lambda offer: self._sort_key(offer, sort),
        )
        paged = sorted_products[offset : offset + limit]

        items = [self._build_product_search_response(offer) for offer in paged]
        return ProductSearchResult(
            items=items,
            meta=ProductSearchMeta(limit=limit, offset=offset, returned=len(items)),
        )

    def get_product_detail(self, product_id: str) -> ProductDetailResponse:
        product = self.products.get_by_id(product_id)
        if product is None:
            raise NotFoundError("Product not found")

        ranked_offers = self._rank_product_offers(product)
        if not ranked_offers:
            raise NotFoundError("No active offers available for this product")

        best_offer = max(ranked_offers, key=lambda offer: offer.ranking.score_total)
        product_response = self._build_product_search_response(best_offer)
        offers_response = [
            self._build_offer_response(ranked_offer)
            for ranked_offer in sorted(ranked_offers, key=lambda offer: offer.row.price.amount)
        ]
        history_response = self._build_price_history(product)

        return ProductDetailResponse(
            product=product_response,
            offers=offers_response,
            price_history=history_response,
        )

    def _is_better(self, candidate: RankedOffer, current: RankedOffer, sort: SearchSort) -> bool:
        return self._sort_key(candidate, sort) < self._sort_key(current, sort)

    def _sort_key(self, offer: RankedOffer, sort: SearchSort) -> tuple[float, float, float, float]:
        # Prioritise products with boost, then sponsored, then others.
        is_boosted = self._is_product_boosted(offer.row.product)
        is_sponsored = bool(getattr(offer.row.product, "is_sponsored", False))
        if is_boosted:
            boost_rank = 0.0
        elif is_sponsored:
            boost_rank = 0.5
        else:
            boost_rank = 1.0
        if sort == "price_asc":
            return (
                boost_rank,
                offer.row.price.amount,
                -offer.ranking.score_total,
                -offer.row.price.stock_quantity,
            )
        if sort == "price_desc":
            return (
                boost_rank,
                -offer.row.price.amount,
                -offer.ranking.score_total,
                -offer.row.price.stock_quantity,
            )
        if sort == "newest":
            created_at = offer.row.product.created_at
            created_timestamp = self._to_timestamp(created_at)
            return (
                -created_timestamp,
                boost_rank,
                -offer.ranking.score_total,
                offer.row.price.amount,
            )
        return (
            boost_rank,
            -offer.ranking.score_total,
            offer.row.price.amount,
            -offer.row.price.stock_quantity,
        )

    def _to_timestamp(self, value: datetime) -> float:
        return value.timestamp()

    def _build_product_search_response(self, offer: RankedOffer) -> ProductSearchResponse:
        is_boosted = self._is_product_boosted(offer.row.product)
        category = (
            CategoryResponse(
                id=offer.row.product.category.id,
                name=offer.row.product.category.name,
                slug=offer.row.product.category.slug,
            )
            if offer.row.product.category
            else None
        )
        _sorted_images = sorted(offer.row.product.images, key=lambda image: image.sort_order)
        images = [
            ProductImageResponse(
                id=image.id,
                image_url=image.image_url,
                sort_order=image.sort_order,
            )
            for image in _sorted_images[:6]
        ]
        ranking = RankingBreakdownResponse(
            price_competitiveness=offer.ranking.price_competitiveness,
            stock_signal=offer.ranking.stock_signal,
            text_relevance=offer.ranking.text_relevance,
            vendor_signal=offer.ranking.vendor_signal,
            score_total=offer.ranking.score_total,
        )
        best_offer = self._build_offer_response(offer)
        return ProductSearchResponse(
            id=offer.row.product.id,
            name=offer.row.product.name,
            brand=offer.row.product.brand,
            description=offer.row.product.description,
            main_image_url=offer.row.product.main_image_url,
            is_sponsored=bool(getattr(offer.row.product, "is_sponsored", False)),
            is_boosted=is_boosted,
            ad_banner_url=getattr(offer.row.product, "ad_banner_url", None),
            specs=offer.row.product.specs,
            category=category,
            created_at=offer.row.product.created_at,
            images=images,
            best_offer=best_offer,
        )

    def _build_offer_response(self, offer: RankedOffer) -> OfferResponse:
        ranking = RankingBreakdownResponse(
            price_competitiveness=offer.ranking.price_competitiveness,
            stock_signal=offer.ranking.stock_signal,
            text_relevance=offer.ranking.text_relevance,
            vendor_signal=offer.ranking.vendor_signal,
            score_total=offer.ranking.score_total,
        )
        return OfferResponse(
            price_id=offer.row.price.id,
            vendor=VendorResponse(
                id=offer.row.price.vendor.id,
                name=offer.row.price.vendor.name,
                slug=offer.row.price.vendor.slug,
                is_active=offer.row.price.vendor.is_active,
                is_verified=bool(
                    getattr(getattr(offer.row.price.vendor, "seller_profile", None), "is_verified", False)
                ),
            ),
            currency=offer.row.price.currency,
            amount=offer.row.price.amount,
            stock_quantity=offer.row.price.stock_quantity,
            is_active=offer.row.price.is_active,
            ranking=ranking,
        )

    def _rank_product_offers(self, product: Product) -> list[RankedOffer]:
        active_prices = [
            price
            for price in product.prices
            if (
                price.is_active
                and self._is_vendor_publicly_visible(getattr(price, "vendor", None))
                and is_allowed_public_product_offer(getattr(getattr(price, "vendor", None), "name", None))
            )
        ]
        if not active_prices:
            return []

        amounts = [price.amount for price in active_prices]
        min_amount = min(amounts)
        max_amount = max(amounts)

        return [
            RankedOffer(
                row=SearchOfferRow(
                    product=product,
                    price=price,
                    text_rank=0.0,
                ),
                ranking=self.ranking.score_offer(
                    amount=price.amount,
                    min_amount=min_amount,
                    max_amount=max_amount,
                    stock_quantity=price.stock_quantity,
                    text_relevance=0.0,
                    vendor_is_active=price.vendor.is_active,
                ),
            )
            for price in active_prices
        ]

    def _build_price_history(self, product: Product) -> list[PriceHistoryPointResponse]:
        history_points: list[PriceHistoryPointResponse] = []
        for price in product.prices:
            for entry in price.history_entries:
                history_points.append(
                    PriceHistoryPointResponse(
                        changed_at=entry.changed_at,
                        amount=entry.new_amount,
                    )
                )

            history_points.append(
                PriceHistoryPointResponse(
                    changed_at=price.updated_at,
                    amount=price.amount,
                )
            )

        unique_points: dict[tuple[datetime, float], PriceHistoryPointResponse] = {
            (point.changed_at, point.amount): point
            for point in history_points
        }
        return sorted(unique_points.values(), key=lambda point: point.changed_at)

    def _is_vendor_publicly_visible(self, vendor) -> bool:
        if vendor is None or not bool(getattr(vendor, "is_active", False)):
            return False
        profile = getattr(vendor, "seller_profile", None)
        owner = getattr(profile, "user", None)
        if owner is not None and not bool(getattr(owner, "is_active", False)):
            return False
        return True

    def _is_public_offer_allowed(self, row: SearchOfferRow) -> bool:
        vendor_name = getattr(getattr(row, "price", None), "vendor", None)
        vendor_name = getattr(vendor_name, "name", None)
        if not is_allowed_public_product_offer(vendor_name):
            return False

        seed_source = product_seed_source(getattr(getattr(row, "product", None), "specs", None))
        if seed_source == "seed_niger_market_v1":
            return False

        if seed_source == "demo_storefronts_v1":
            return is_allowed_public_home_brand(getattr(getattr(row, "product", None), "brand", None))

        return True

    def _is_product_boosted(self, product: Product) -> bool:
        if not bool(getattr(product, "is_boosted", False)):
            return False
        specs = getattr(product, "specs", {}) or {}
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
