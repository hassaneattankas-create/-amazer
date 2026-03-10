from __future__ import annotations

import re
from uuid import uuid4
from typing import Any, Mapping

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.crypto import encrypt_phone_value
from app.models.seller_profile import SellerProfile
from app.models.user import User
from app.models.vendor import Vendor


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def build_unique_vendor_slug(db: Session, business_name: str, fallback_seed: str) -> str:
    slug_base = slugify(business_name) or f"vendor-{fallback_seed[:8]}"
    slug = slug_base
    suffix = 1
    for _ in range(20):
        exists = db.scalar(select(Vendor).where(Vendor.slug == slug))
        if exists is None:
            return slug
        suffix += 1
        slug = f"{slug_base}-{suffix}"
    return f"{slug_base}-{uuid4().hex[:8]}"


def _normalize_string_list(values: Any) -> list[str]:
    if not isinstance(values, list):
        return []
    result: list[str] = []
    for value in values:
        if isinstance(value, str):
            stripped = value.strip()
            if stripped:
                result.append(stripped)
    return result[:12]


def _normalize_service_offerings(values: Any) -> list[dict[str, str]]:
    if not isinstance(values, list):
        return []
    items: list[dict[str, str]] = []
    for value in values:
        if not isinstance(value, Mapping):
            continue
        title = str(value.get("title", "")).strip()
        if not title:
            continue
        description = str(value.get("description", "")).strip()
        display_mode = str(value.get("display_mode", "consult_only")).strip() or "consult_only"
        items.append(
            {
                "title": title[:120],
                "description": description[:600],
                "display_mode": display_mode[:32],
            }
        )
    return items[:20]


def _normalize_room_types(values: Any) -> list[dict[str, Any]]:
    if not isinstance(values, list):
        return []
    items: list[dict[str, Any]] = []
    for index, value in enumerate(values):
        if not isinstance(value, Mapping):
            continue
        room_id = str(value.get("id", "")).strip() or f"room-{index + 1}"
        name = str(value.get("name", "")).strip()
        if not name:
            continue
        description = str(value.get("description", "")).strip()
        amenities = _normalize_string_list(value.get("amenities", []))
        photo_urls = _normalize_string_list(value.get("photo_urls", []))
        raw_price = value.get("night_price")
        raw_capacity = value.get("capacity", 1)
        raw_deposit = value.get("deposit_amount")
        try:
            night_price = float(raw_price)
        except (TypeError, ValueError):
            continue
        try:
            capacity = max(1, int(raw_capacity))
        except (TypeError, ValueError):
            capacity = 1
        deposit_amount: float | None = None
        if raw_deposit not in (None, ""):
            try:
                deposit_amount = max(0.0, float(raw_deposit))
            except (TypeError, ValueError):
                deposit_amount = None
        items.append(
            {
                "id": room_id[:64],
                "name": name[:120],
                "description": description[:1000],
                "night_price": night_price,
                "capacity": capacity,
                "amenities": amenities,
                "photo_urls": photo_urls,
                "deposit_amount": deposit_amount,
            }
        )
    return items[:24]


def apply_seller_profile_payload(profile: SellerProfile, payload: Mapping[str, Any]) -> None:
    profile.business_name = str(payload.get("business_name", profile.business_name)).strip() or profile.business_name
    profile.phone = encrypt_phone_value(payload.get("phone"))
    profile.city = str(payload.get("city", profile.city)).strip() or "Niamey"
    profile.address = str(payload.get("address", "")).strip() or None
    profile.activity_type = str(payload.get("activity_type", profile.activity_type or "shop")).strip() or "shop"
    profile.storefront_tier = str(payload.get("storefront_tier", profile.storefront_tier or "basic")).strip() or "basic"
    profile.description = str(payload.get("description", "")).strip() or None
    profile.logo_url = str(payload.get("logo_url", "")).strip() or None
    profile.cover_image_url = str(payload.get("cover_image_url", "")).strip() or None
    profile.opening_hours = str(payload.get("opening_hours", "")).strip() or None
    profile.whatsapp_contact = str(payload.get("whatsapp_contact", "")).strip() or None
    profile.contact_email = str(payload.get("contact_email", "")).strip().lower() or None
    profile.gallery_images = _normalize_string_list(payload.get("gallery_images", []))
    profile.service_offerings = _normalize_service_offerings(payload.get("service_offerings", []))
    profile.room_types = _normalize_room_types(payload.get("room_types", []))
    payment_method = str(payload.get("deposit_payment_method", "")).strip().lower() or None
    profile.deposit_payment_method = payment_method
    raw_deposit_amount = payload.get("deposit_amount")
    if raw_deposit_amount in (None, ""):
        profile.deposit_amount = None
    else:
        try:
            profile.deposit_amount = max(0.0, float(raw_deposit_amount))
        except (TypeError, ValueError):
            profile.deposit_amount = None
    profile.accepts_table_reservations = bool(payload.get("accepts_table_reservations", False))
    profile.accepts_hotel_bookings = bool(payload.get("accepts_hotel_bookings", False))


def create_or_update_seller_profile(
    db: Session,
    *,
    user: User,
    payload: Mapping[str, Any],
    existing_profile: SellerProfile | None = None,
) -> SellerProfile:
    profile = existing_profile
    if profile is None:
        vendor = Vendor(
            name=str(payload.get("business_name", "")).strip() or user.full_name,
            slug=build_unique_vendor_slug(
                db,
                str(payload.get("business_name", "")).strip() or user.full_name,
                user.id,
            ),
            is_active=True,
        )
        db.add(vendor)
        db.flush()
        profile = SellerProfile(
            user_id=user.id,
            vendor_id=vendor.id,
            business_name=vendor.name,
            city="Niamey",
            activity_type="shop",
        )
        db.add(profile)
        db.flush()
    else:
        vendor = db.get(Vendor, profile.vendor_id)
        if vendor is None:
            vendor = Vendor(
                id=profile.vendor_id,
                name=profile.business_name,
                slug=build_unique_vendor_slug(db, profile.business_name, user.id),
                is_active=True,
            )
            db.add(vendor)
            db.flush()

    apply_seller_profile_payload(profile, payload)
    vendor.name = profile.business_name
    return profile
