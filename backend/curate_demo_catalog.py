from __future__ import annotations

from sqlalchemy import delete, select

from app.core.cache import cache_delete_prefixes
from app.core.security import hash_password
from app.database import SessionLocal
from app.models.ad_click import AdClick
from app.models.cart import CartItem
from app.models.dynamic_section import DynamicSection, DynamicSectionItem
from app.models.hospitality import HotelBooking, RestaurantReservation
from app.models.order import Order, OrderItem
from app.models.price_history import PriceHistory
from app.models.product import Price, Product, ProductImage
from app.models.receipt_scan import ReceiptScan
from app.models.restaurant import RestaurantMenuItem, RestaurantOrder, RestaurantOrderItem
from app.models.seller_profile import SellerProfile
from app.models.user import User
from app.models.vendor import Vendor
from seed_demo_storefronts import COMMON_PASSWORD

KEEP_SHOPS = {"Amazer", "Fragrance"}
KEEP_RESTAURANTS = {"Le Sahel Rooftop"}
KEEP_PROFILES = KEEP_SHOPS | KEEP_RESTAURANTS
CURATED_HOME_SECTION = {
    "title": "Selection AMAZER",
    "slug": "selection-amazer",
    "section_type": "mixed",
}
CURATED_HOME_PRODUCTS = [
    "Panier Epicerie Signature Amazer",
    "Huile d'Olive Reserve Mediterranee",
    "Extrait Oud Prestige 100ml",
    "Brume Rose Noire",
]
CURATED_HOME_RESTAURANT = "Le Sahel Rooftop"


def should_keep_profile(profile: SellerProfile) -> bool:
    activity_type = (profile.activity_type or "").strip().lower()
    if activity_type == "shop":
        return profile.business_name in KEEP_SHOPS
    if activity_type == "restaurant":
        return profile.business_name in KEEP_RESTAURANTS
    if activity_type == "hotel":
        return True
    return False


def main() -> None:
    db = SessionLocal()
    try:
        profiles = db.scalars(select(SellerProfile)).all()
        removable_profiles = [profile for profile in profiles if not should_keep_profile(profile)]
        removable_profile_ids = {profile.id for profile in removable_profiles}
        removable_user_ids = {profile.user_id for profile in removable_profiles}
        removable_vendor_ids = {profile.vendor_id for profile in removable_profiles}

        profile_vendor_ids = {profile.vendor_id for profile in profiles}
        standalone_vendor_ids = {
            vendor.id for vendor in db.scalars(select(Vendor)).all() if vendor.id not in profile_vendor_ids
        }
        removable_vendor_ids.update(standalone_vendor_ids)

        removable_order_ids = {
            order_id
            for order_id in db.scalars(
                select(OrderItem.order_id).where(OrderItem.vendor_id.in_(removable_vendor_ids))
            ).all()
        }
        removable_restaurant_order_ids = {
            order_id
            for order_id in db.scalars(
                select(RestaurantOrder.id).where(RestaurantOrder.vendor_id.in_(removable_vendor_ids))
            ).all()
        }
        removable_price_ids = {
            price_id
            for price_id in db.scalars(select(Price.id).where(Price.vendor_id.in_(removable_vendor_ids))).all()
        }

        if removable_order_ids:
            db.execute(delete(ReceiptScan).where(ReceiptScan.order_id.in_(removable_order_ids)))
            db.execute(delete(OrderItem).where(OrderItem.order_id.in_(removable_order_ids)))
            db.execute(delete(Order).where(Order.id.in_(removable_order_ids)))

        if removable_restaurant_order_ids:
            db.execute(delete(RestaurantOrderItem).where(RestaurantOrderItem.order_id.in_(removable_restaurant_order_ids)))
            db.execute(delete(RestaurantOrder).where(RestaurantOrder.id.in_(removable_restaurant_order_ids)))

        db.execute(delete(RestaurantReservation).where(RestaurantReservation.vendor_id.in_(removable_vendor_ids)))
        db.execute(delete(HotelBooking).where(HotelBooking.vendor_id.in_(removable_vendor_ids)))
        db.execute(delete(RestaurantMenuItem).where(RestaurantMenuItem.vendor_id.in_(removable_vendor_ids)))

        if removable_price_ids:
            db.execute(delete(PriceHistory).where(PriceHistory.price_id.in_(removable_price_ids)))
        db.execute(delete(Price).where(Price.vendor_id.in_(removable_vendor_ids)))

        orphan_product_ids = {
            product.id
            for product in db.scalars(select(Product)).all()
            if not db.scalar(select(Price.id).where(Price.product_id == product.id).limit(1))
        }
        if orphan_product_ids:
            db.execute(delete(AdClick).where(AdClick.product_id.in_(orphan_product_ids)))
            db.execute(delete(CartItem).where(CartItem.product_id.in_(orphan_product_ids)))
            db.execute(delete(ProductImage).where(ProductImage.product_id.in_(orphan_product_ids)))
            db.execute(delete(Product).where(Product.id.in_(orphan_product_ids)))

        db.execute(delete(DynamicSectionItem))
        db.execute(delete(DynamicSection))

        if removable_profile_ids:
            db.execute(delete(SellerProfile).where(SellerProfile.id.in_(removable_profile_ids)))
        if removable_user_ids:
            db.execute(delete(User).where(User.id.in_(removable_user_ids)))
        db.execute(delete(Vendor).where(Vendor.id.in_(removable_vendor_ids)))

        for business_name in KEEP_PROFILES:
            profile = db.scalar(select(SellerProfile).where(SellerProfile.business_name == business_name))
            if profile is None:
                continue
            profile.is_verified = True
            user = db.get(User, profile.user_id)
            if user is not None:
                user.is_active = True
                user.hashed_password = hash_password(COMMON_PASSWORD)
            vendor = db.get(Vendor, profile.vendor_id)
            if vendor is not None:
                vendor.is_active = True

        section = DynamicSection(
            title=CURATED_HOME_SECTION["title"],
            slug=CURATED_HOME_SECTION["slug"],
            section_type=CURATED_HOME_SECTION["section_type"],
            is_active=True,
            sort_order=0,
        )
        db.add(section)
        db.flush()

        sort_order = 0
        for product_name in CURATED_HOME_PRODUCTS:
            product = db.scalar(select(Product).where(Product.name == product_name).limit(1))
            if product is None:
                continue
            db.add(
                DynamicSectionItem(
                    section_id=section.id,
                    target_type="product",
                    product_id=product.id,
                    sort_order=sort_order,
                )
            )
            sort_order += 1

        restaurant_profile = db.scalar(
            select(SellerProfile).where(SellerProfile.business_name == CURATED_HOME_RESTAURANT).limit(1)
        )
        if restaurant_profile is not None:
            db.add(
                DynamicSectionItem(
                    section_id=section.id,
                    target_type="restaurant",
                    vendor_id=restaurant_profile.vendor_id,
                    sort_order=sort_order,
                )
            )

        db.commit()
        cache_delete_prefixes("catalog:", "content:")

        remaining_profiles = db.scalars(
            select(SellerProfile).order_by(SellerProfile.activity_type.asc(), SellerProfile.business_name.asc())
        ).all()
        remaining_products = db.scalars(
            select(Product).order_by(Product.name.asc())
        ).all()

        print("Catalogue demo nettoye.")
        print(f"- Shops gardees: {sorted(KEEP_SHOPS)}")
        print(f"- Restaurant garde: {sorted(KEEP_RESTAURANTS)}")
        print(f"- Profils restants: {len(remaining_profiles)}")
        print(f"- Produits restants: {len(remaining_products)}")
        print(f"- Mot de passe demos: {COMMON_PASSWORD}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
