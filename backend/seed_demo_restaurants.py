from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models as _models  # noqa: F401
from app.core.crypto import encrypt_phone_value
from app.database import SessionLocal
from app.models.hospitality import HotelBooking, RestaurantReservation
from app.models.restaurant import RestaurantMenuItem, RestaurantOrder, RestaurantOrderItem
from app.models.seller_profile import SellerProfile
from app.models.vendor import Vendor
from seed_demo_storefronts import COMMON_PASSWORD, ensure_profile, ensure_user


RESTAURANTS = [
    {
        "full_name": "Chef Le Sahel Rooftop",
        "email": "demo.sahelrooftop@amazer.demo",
        "phone": "+22790003001",
        "profile": {
            "business_name": "Le Sahel Rooftop",
            "phone": "+22790003001",
            "city": "Niamey",
            "address": "Plateau, rooftop panoramique",
            "activity_type": "restaurant",
            "storefront_tier": "premium",
            "description": "Restaurant panoramique pour diners sunset, grillades premium et mocktails signatures.",
            "logo_url": "https://placehold.co/256x256/1f2937/f97316/png?text=SR",
            "cover_image_url": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80",
            "opening_hours": "Lun-Dim 12:00-23:30",
            "whatsapp_contact": "+22790003001",
            "contact_email": "hello@sahelrooftop.demo",
            "gallery_images": [
                "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1600&q=80",
                "https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=1600&q=80",
                "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1600&q=80",
            ],
            "service_offerings": [
                {"title": "Terrasse Sunset", "description": "Vue premium et ambiance lounge.", "display_mode": "consult_only"},
                {"title": "WiFi", "description": "Connexion stable pour dejeuners business.", "display_mode": "consult_only"},
                {"title": "Bar Signature", "description": "Mocktails epices et tea pairing.", "display_mode": "consult_only"},
            ],
            "accepts_table_reservations": True,
        },
        "menu": [
            {"name": "Brochette Sahel Signature", "description": "Brochettes premium et jus reduction maison.", "image_url": "https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=1200&q=80", "base_price": 18500, "tags": ["Plat du Jour", "Populaire"], "options": [{"name": "Frites patates douces", "price": 2500}, {"name": "Sauce piment doux", "price": 1000}], "estimated_prep_minutes": 24},
            {"name": "Thieb Poulet Rooftop", "description": "Riz parfume, legumes braises et dressage chic.", "image_url": "https://images.unsplash.com/photo-1517244683847-7456b63c5969?auto=format&fit=crop&w=1200&q=80", "base_price": 16000, "tags": ["Chaud", "Maison"], "options": [{"name": "Portion extra", "price": 3000}], "estimated_prep_minutes": 20},
            {"name": "Mocktail Fleur d'Ayer", "description": "Agrumes et sirop floral maison.", "image_url": "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=1200&q=80", "base_price": 6500, "tags": ["Boisson", "Signature"], "options": [{"name": "Version ginger", "price": 800}], "estimated_prep_minutes": 8},
        ],
    },
    {
        "full_name": "Chef Maison Djerma Dining",
        "email": "demo.djermadining@amazer.demo",
        "phone": "+22790003002",
        "profile": {
            "business_name": "Maison Djerma Dining",
            "phone": "+22790003002",
            "city": "Niamey",
            "address": "Quartier Yantala, maison de table contemporaine",
            "activity_type": "restaurant",
            "storefront_tier": "premium",
            "description": "Maison de cuisine locale contemporaine, tea room et reservation privee.",
            "logo_url": "https://placehold.co/256x256/0f172a/f59e0b/png?text=MD",
            "cover_image_url": "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1600&q=80",
            "opening_hours": "Mar-Dim 11:30-22:30",
            "whatsapp_contact": "+22790003002",
            "contact_email": "booking@djermadining.demo",
            "gallery_images": [
                "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1600&q=80",
                "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=1600&q=80",
                "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1600&q=80",
            ],
            "service_offerings": [
                {"title": "Tea Room", "description": "Selection de thes et accords desserts.", "display_mode": "consult_only"},
                {"title": "Table Chef", "description": "Experience degustation sur reservation.", "display_mode": "consult_only"},
                {"title": "WiFi", "description": "Connexion stable business lunch.", "display_mode": "consult_only"},
            ],
            "accepts_table_reservations": True,
        },
        "menu": [
            {"name": "Filet de Capitaine du Fleuve", "description": "Poisson grille et condiments citronnes.", "image_url": "https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=1200&q=80", "base_price": 21000, "tags": ["Plat du Jour", "Signature"], "options": [{"name": "Legumes croquants", "price": 2000}], "estimated_prep_minutes": 22},
            {"name": "Salade Mango Sahel", "description": "Mangue, herbes fraiches et sauce sesame.", "image_url": "https://images.unsplash.com/photo-1546793665-c74683f339c1?auto=format&fit=crop&w=1200&q=80", "base_price": 9800, "tags": ["Frais", "Populaire"], "options": [{"name": "Poulet grille", "price": 3500}], "estimated_prep_minutes": 12},
            {"name": "Dessert Millet Caramel", "description": "Creme millet et caramel sale.", "image_url": "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=1200&q=80", "base_price": 5500, "tags": ["Dessert", "Maison"], "options": [{"name": "Glace vanille", "price": 1500}], "estimated_prep_minutes": 10},
        ],
    },
    {
        "full_name": "Chef Nomad Grill and Tea",
        "email": "demo.nomadgrill@amazer.demo",
        "phone": "+22790003003",
        "profile": {
            "business_name": "Nomad Grill & Tea",
            "phone": "+22790003003",
            "city": "Niamey",
            "address": "Rive droite, maison lounge nomade",
            "activity_type": "restaurant",
            "storefront_tier": "premium",
            "description": "Grill house premium et salon de the sahelien pour dejeuners, commandes express et tables de groupe.",
            "logo_url": "https://placehold.co/256x256/111827/22c55e/png?text=NG",
            "cover_image_url": "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1600&q=80",
            "opening_hours": "Lun-Dim 10:30-23:00",
            "whatsapp_contact": "+22790003003",
            "contact_email": "contact@nomadgrill.demo",
            "gallery_images": [
                "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1600&q=80",
                "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1600&q=80",
                "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1600&q=80",
            ],
            "service_offerings": [
                {"title": "Grill Live", "description": "Cuisson minute et comptoir ouvert.", "display_mode": "consult_only"},
                {"title": "Salon de The", "description": "Infusions premium et patisseries legeres.", "display_mode": "consult_only"},
                {"title": "Reservation Groupe", "description": "Tables 6 a 12 personnes.", "display_mode": "consult_only"},
            ],
            "accepts_table_reservations": True,
        },
        "menu": [
            {"name": "Burger Zinder Smoke", "description": "Boeuf fume, cheddar et oignons confits.", "image_url": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=80", "base_price": 14500, "tags": ["Populaire", "Chaud"], "options": [{"name": "Frites maison", "price": 2000}, {"name": "Cheddar extra", "price": 1200}], "estimated_prep_minutes": 18},
            {"name": "Wrap Poulet Nomade", "description": "Wrap grille et sauce yaourt cumin.", "image_url": "https://images.unsplash.com/photo-1539252554453-80ab65ce3586?auto=format&fit=crop&w=1200&q=80", "base_price": 9800, "tags": ["Plat du Jour", "Express"], "options": [{"name": "Boisson gingembre", "price": 1500}], "estimated_prep_minutes": 14},
            {"name": "The Glace Menthe Safran", "description": "Infusion glacee menthe fraiche et pointe safran.", "image_url": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=1200&q=80", "base_price": 4800, "tags": ["Boisson", "Signature"], "options": [{"name": "Citron confit", "price": 600}], "estimated_prep_minutes": 7},
        ],
    },
]


def ensure_menu_item(db: Session, vendor_id: str, seed: dict) -> RestaurantMenuItem:
    row = db.scalar(select(RestaurantMenuItem).where(RestaurantMenuItem.vendor_id == vendor_id, RestaurantMenuItem.name == seed["name"]).limit(1))
    if row is None:
        row = RestaurantMenuItem(vendor_id=vendor_id, name=seed["name"])
        db.add(row)
    row.description = seed.get("description")
    row.image_url = seed.get("image_url")
    row.base_price = float(seed["base_price"])
    row.currency = "XOF"
    row.is_available = True
    row.tags = list(seed.get("tags", []))
    row.options = list(seed.get("options", []))
    row.estimated_prep_minutes = int(seed.get("estimated_prep_minutes", 20))
    db.flush()
    return row


def ensure_restaurant_order(db: Session, vendor_id: str, user_id: str, customer_name: str, customer_phone: str, delivery_address: str, distance_km: float, payment_mode: str, status: str, lines: list[dict]) -> None:
    row = db.scalar(select(RestaurantOrder).where(RestaurantOrder.vendor_id == vendor_id, RestaurantOrder.customer_name == customer_name, RestaurantOrder.delivery_address == delivery_address).limit(1))
    if row is None:
        row = RestaurantOrder(
            vendor_id=vendor_id,
            user_id=user_id,
            customer_name=customer_name,
            customer_phone=customer_phone,
            delivery_address=delivery_address,
            distance_km=distance_km,
            delivery_minutes=max(15, int(round(8 + (distance_km * 4.5) + 20))),
            payment_mode=payment_mode,
            status=status,
            total_amount=0,
            currency="XOF",
        )
        db.add(row)
        db.flush()
    row.user_id = user_id
    row.customer_phone = customer_phone
    row.distance_km = distance_km
    row.delivery_minutes = max(15, int(round(8 + (distance_km * 4.5) + 20)))
    row.payment_mode = payment_mode
    row.status = status
    row.currency = "XOF"
    row.total_amount = 0
    row.items.clear()
    total = 0.0
    for line in lines:
        dish = ensure_menu_item(db, vendor_id, line["menu"])
        selected_options = list(line.get("selected_options", []))
        unit_price = dish.base_price + sum(float(option["price"]) for option in selected_options)
        quantity = int(line.get("quantity", 1))
        subtotal = unit_price * quantity
        total += subtotal
        row.items.append(RestaurantOrderItem(menu_item_id=dish.id, quantity=quantity, selected_options=selected_options, unit_price=unit_price, subtotal=subtotal))
    row.total_amount = total
    db.flush()


def ensure_restaurant_reservation(db: Session, vendor_id: str, user_id: str, customer_name: str, customer_phone: str, reservation_at: datetime, guest_count: int, note: str, status: str) -> None:
    row = db.scalar(select(RestaurantReservation).where(RestaurantReservation.vendor_id == vendor_id, RestaurantReservation.customer_name == customer_name, RestaurantReservation.note == note).limit(1))
    if row is None:
        row = RestaurantReservation(
            vendor_id=vendor_id,
            user_id=user_id,
            customer_name=customer_name,
            customer_phone=encrypt_phone_value(customer_phone) or customer_phone,
            reservation_at=reservation_at,
            guest_count=guest_count,
            note=note,
            status=status,
        )
        db.add(row)
    row.user_id = user_id
    row.customer_phone = encrypt_phone_value(customer_phone) or customer_phone
    row.reservation_at = reservation_at
    row.guest_count = guest_count
    row.status = status
    db.flush()


def ensure_hotel_booking(db: Session, vendor_id: str, user_id: str, guest_name: str, guest_phone: str, room: dict, payment_method: str, transaction_reference: str, status: str) -> None:
    row = db.scalar(select(HotelBooking).where(HotelBooking.vendor_id == vendor_id, HotelBooking.transaction_reference == transaction_reference).limit(1))
    if row is None:
        row = HotelBooking(
            vendor_id=vendor_id,
            user_id=user_id,
            room_type_id=str(room["id"]),
            room_snapshot=room,
            guest_name=guest_name,
            guest_phone=encrypt_phone_value(guest_phone) or guest_phone,
            guest_email="demo.client@amazer.demo",
            check_in_date=date.today() + timedelta(days=7),
            check_out_date=date.today() + timedelta(days=9),
            guest_count=2,
            deposit_payment_method=payment_method,
            deposit_amount=float(room.get("deposit_amount") or 0),
            transaction_reference=transaction_reference,
            special_request=f"demo-seed-{transaction_reference.lower()}",
            status=status,
        )
        db.add(row)
    row.user_id = user_id
    row.room_type_id = str(room["id"])
    row.room_snapshot = room
    row.guest_phone = encrypt_phone_value(guest_phone) or guest_phone
    row.guest_email = "demo.client@amazer.demo"
    row.check_in_date = date.today() + timedelta(days=7)
    row.check_out_date = date.today() + timedelta(days=9)
    row.guest_count = 2
    row.deposit_payment_method = payment_method
    row.deposit_amount = float(room.get("deposit_amount") or 0)
    row.transaction_reference = transaction_reference
    row.special_request = f"demo-seed-{transaction_reference.lower()}"
    row.status = status
    db.flush()


def main() -> None:
    db = SessionLocal()
    try:
        profile_map: dict[str, SellerProfile] = {}
        for restaurant in RESTAURANTS:
            user = ensure_user(db, restaurant["email"], restaurant["full_name"], restaurant["phone"])
            profile = ensure_profile(db, user, restaurant["profile"])
            profile_map[restaurant["profile"]["business_name"]] = profile
            for menu_item in restaurant["menu"]:
                ensure_menu_item(db, profile.vendor_id, menu_item)

        demo_customer = ensure_user(db, "demo.client@amazer.demo", "Client Demo AMAZER", "+22790009999")

        ensure_restaurant_order(db, profile_map["Le Sahel Rooftop"].vendor_id, demo_customer.id, "Client Demo AMAZER", "+22790009999", "Plateau, immeuble A demo", 3.2, "nita", "preparation", [{"menu": RESTAURANTS[0]["menu"][0], "quantity": 1, "selected_options": [{"name": "Frites patates douces", "price": 2500}]}, {"menu": RESTAURANTS[0]["menu"][2], "quantity": 2}])
        ensure_restaurant_order(db, profile_map["Maison Djerma Dining"].vendor_id, demo_customer.id, "Amina Audit Demo", "+22790009998", "Yantala, bureau demo 4", 5.4, "amana", "livraison", [{"menu": RESTAURANTS[1]["menu"][0], "quantity": 1, "selected_options": [{"name": "Legumes croquants", "price": 2000}]}])
        ensure_restaurant_order(db, profile_map["Nomad Grill & Tea"].vendor_id, demo_customer.id, "Equipe Produit AMAZER", "+22790009997", "Rive droite, atelier demo", 2.1, "cash_on_delivery", "commande", [{"menu": RESTAURANTS[2]["menu"][0], "quantity": 2, "selected_options": [{"name": "Cheddar extra", "price": 1200}]}, {"menu": RESTAURANTS[2]["menu"][2], "quantity": 2, "selected_options": [{"name": "Citron confit", "price": 600}]}])

        ensure_restaurant_reservation(db, profile_map["Le Sahel Rooftop"].vendor_id, demo_customer.id, "Client Demo AMAZER", "+22790009999", datetime.now(UTC) + timedelta(days=1, hours=8), 4, "demo-seed-sahel-reservation", "confirmed")
        ensure_restaurant_reservation(db, profile_map["Maison Djerma Dining"].vendor_id, demo_customer.id, "Amina Audit Demo", "+22790009998", datetime.now(UTC) + timedelta(days=2, hours=6), 2, "demo-seed-djerma-reservation", "pending")
        ensure_restaurant_reservation(db, profile_map["Nomad Grill & Tea"].vendor_id, demo_customer.id, "Equipe Produit AMAZER", "+22790009997", datetime.now(UTC) + timedelta(days=3, hours=5), 6, "demo-seed-nomad-reservation", "confirmed")

        for hotel_name, room_index, status, reference in [("Radisson Blu Niamey", 0, "confirmed", "HOTEL-DEMO-RADISSON"), ("Hotel Soluxe Niamey", 1, "pending", "HOTEL-DEMO-SOLUXE"), ("Grand Hotel du Fleuve", 0, "confirmed", "HOTEL-DEMO-FLEUVE")]:
            hotel_profile = db.scalar(select(SellerProfile).where(SellerProfile.business_name == hotel_name).limit(1))
            if hotel_profile is not None and hotel_profile.room_types:
                ensure_hotel_booking(db, hotel_profile.vendor_id, demo_customer.id, "Client Demo AMAZER", "+22790009999", hotel_profile.room_types[room_index], str(hotel_profile.deposit_payment_method or "nita"), reference, status)

        db.commit()
        print("Demo restaurants seed termine.")
        print("- Restaurants premium: 3")
        print("- Orders/reservations/bookings: seeded")
        print(f"- Password: {COMMON_PASSWORD}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
