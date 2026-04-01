from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app import models as _models  # noqa: F401
from app.core.security import hash_password
from app.database import SessionLocal
from app.models.category import Category
from app.models.price_history import PriceHistory
from app.models.product import Price, Product, ProductImage
from app.models.seller_profile import SellerProfile
from app.models.user import User
from app.models.user_preferences import UserPreferences
from app.models.vendor import Vendor
from app.services.seller_profile_service import create_or_update_seller_profile


COMMON_PASSWORD = "AmazerDemo2026!"
PROMO_UNTIL = (datetime.now(UTC) + timedelta(days=30)).isoformat()
ACTIVE_DEMO_EMAILS = {
    "demo.amazer.market@amazer.demo",
    "demo.fragrance@amazer.demo",
    "demo.radisson@amazer.demo",
    "demo.soluxe@amazer.demo",
    "demo.fleuve@amazer.demo",
    "demo.azalai@amazer.demo",
    "demo.sahelpalace@amazer.demo",
}


def ensure_category(db: Session, slug: str, name: str) -> Category:
    row = db.scalar(select(Category).where(Category.slug == slug))
    if row is None:
        row = Category(name=name, slug=slug, is_active=True)
        db.add(row)
        db.flush()
    else:
        row.is_active = True
    return row


def ensure_user(db: Session, email: str, full_name: str, whatsapp_phone: str) -> User:
    row = db.scalar(select(User).where(User.email == email.lower()))
    if row is None:
        row = User(
            email=email.lower(),
            full_name=full_name,
            whatsapp_phone=whatsapp_phone,
            hashed_password=hash_password(COMMON_PASSWORD),
            is_active=True,
        )
        db.add(row)
        db.flush()
    else:
        row.full_name = full_name
        row.whatsapp_phone = whatsapp_phone
        row.is_active = True
    if db.scalar(select(UserPreferences).where(UserPreferences.user_id == row.id)) is None:
        db.add(UserPreferences(user_id=row.id, preferred_currency="XOF"))
        db.flush()
    return row


def ensure_profile(db: Session, user: User, payload: dict) -> SellerProfile:
    existing = db.scalar(select(SellerProfile).where(SellerProfile.user_id == user.id))
    profile = create_or_update_seller_profile(db, user=user, payload=payload, existing_profile=existing)
    profile.is_verified = True
    db.flush()
    return profile


def ensure_product(db: Session, vendor_id: str, category_id: str, seed: dict) -> None:
    row = db.execute(
        select(Product, Price)
        .join(Price, Price.product_id == Product.id)
        .where(and_(Price.vendor_id == vendor_id, Product.name == seed["name"]))
        .limit(1)
    ).first()
    specs = {"seed_source": "demo_storefronts_v1"}
    if seed.get("promo_amount"):
        specs["promo_price"] = float(seed["promo_amount"])
        specs["promo_until"] = PROMO_UNTIL
    if row is None:
        product = Product(
            name=seed["name"],
            brand=seed["brand"],
            description=seed["description"],
            main_image_url=seed["image_url"],
            ad_banner_url=seed["image_url"],
            is_sponsored=bool(seed.get("is_sponsored")),
            is_boosted=bool(seed.get("is_boosted")),
            category_id=category_id,
            specs=specs,
        )
        db.add(product)
        db.flush()
        price = Price(
            product_id=product.id,
            vendor_id=vendor_id,
            currency="XOF",
            amount=float(seed["amount"]),
            stock_quantity=int(seed["stock_quantity"]),
            is_active=True,
        )
        db.add(price)
        db.flush()
        db.add(
            PriceHistory(
                price_id=price.id,
                previous_amount=price.amount,
                new_amount=price.amount,
                previous_stock_quantity=price.stock_quantity,
                new_stock_quantity=price.stock_quantity,
                reason="demo_seed_created",
            )
        )
        db.add(ProductImage(product_id=product.id, image_url=seed["image_url"], sort_order=0))
        db.flush()
        return
    product, price = row
    product.brand = seed["brand"]
    product.description = seed["description"]
    product.main_image_url = seed["image_url"]
    product.ad_banner_url = seed["image_url"]
    product.is_sponsored = bool(seed.get("is_sponsored"))
    product.is_boosted = bool(seed.get("is_boosted"))
    product.category_id = category_id
    product.specs = specs
    price.currency = "XOF"
    price.amount = float(seed["amount"])
    price.stock_quantity = int(seed["stock_quantity"])
    price.is_active = True
    image = db.scalar(select(ProductImage).where(ProductImage.product_id == product.id).limit(1))
    if image is None:
        db.add(ProductImage(product_id=product.id, image_url=seed["image_url"], sort_order=0))
    else:
        image.image_url = seed["image_url"]
        image.sort_order = 0
    db.flush()


DATA = [
    {
        "full_name": "Direction Radisson Blu Niamey",
        "email": "demo.radisson@amazer.demo",
        "phone": "+22790001001",
        "profile": {
            "business_name": "Radisson Blu Niamey",
            "phone": "+22790001001",
            "city": "Niamey",
            "address": "Boulevard de l'Independance, Plateau",
            "activity_type": "hotel",
            "storefront_tier": "premium",
            "description": "Hotel luxe business avec suites panoramiques, spa prive et conciergerie.",
            "logo_url": "https://placehold.co/256x256/0f172a/fbbf24/png?text=RB",
            "cover_image_url": "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1600&q=80",
            "opening_hours": "Reception 24h/24",
            "whatsapp_contact": "+22790001001",
            "contact_email": "reservations@radissonblu-niamey.demo",
            "gallery_images": [
                "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1600&q=80",
                "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1600&q=80",
                "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1600&q=80",
            ],
            "service_offerings": [
                {"title": "Piscine", "description": "Piscine a debordement.", "display_mode": "consult_only"},
                {"title": "WiFi", "description": "Internet premium multi-device.", "display_mode": "consult_only"},
                {"title": "Restaurant", "description": "Table signature et room service.", "display_mode": "consult_only"},
                {"title": "Spa", "description": "Soins bien-etre sur reservation.", "display_mode": "consult_only"},
            ],
            "room_types": [
                {"id": "radisson-deluxe", "name": "Deluxe River View", "description": "Vue fleuve.", "night_price": 235000, "capacity": 2, "amenities": ["King bed", "Piscine", "WiFi"], "photo_urls": ["https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1400&q=80"], "deposit_amount": 75000},
                {"id": "radisson-suite", "name": "Junior Suite", "description": "Salon prive.", "night_price": 325000, "capacity": 3, "amenities": ["Spa", "WiFi", "Late checkout"], "photo_urls": ["https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1400&q=80"], "deposit_amount": 95000},
                {"id": "radisson-presidential", "name": "Presidential Suite", "description": "Majordome et terrasse.", "night_price": 480000, "capacity": 4, "amenities": ["Majordome", "Spa", "Transfert VIP"], "photo_urls": ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=80"], "deposit_amount": 140000},
            ],
            "deposit_payment_method": "nita",
            "deposit_amount": 75000,
            "accepts_hotel_bookings": True,
        },
        "products": [],
    },
    {
        "full_name": "Direction Hotel Soluxe Niamey",
        "email": "demo.soluxe@amazer.demo",
        "phone": "+22790001002",
        "profile": {
            "business_name": "Hotel Soluxe Niamey",
            "phone": "+22790001002",
            "city": "Niamey",
            "address": "Quartier Plateau, avenue des affaires",
            "activity_type": "hotel",
            "storefront_tier": "premium",
            "description": "Refuge business chic avec architecture contemporaine, fusion dining et spa.",
            "logo_url": "https://placehold.co/256x256/1e293b/f97316/png?text=SX",
            "cover_image_url": "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1600&q=80",
            "opening_hours": "Reception 24h/24",
            "whatsapp_contact": "+22790001002",
            "contact_email": "hello@soluxe-niamey.demo",
            "gallery_images": [
                "https://images.unsplash.com/photo-1455587734955-081b22074882?auto=format&fit=crop&w=1600&q=80",
                "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1600&q=80",
                "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1600&q=80",
            ],
            "service_offerings": [
                {"title": "Piscine", "description": "Bassin design.", "display_mode": "consult_only"},
                {"title": "WiFi", "description": "Connexion fibre prioritaire.", "display_mode": "consult_only"},
                {"title": "Restaurant", "description": "Cuisine fusion et tea lounge.", "display_mode": "consult_only"},
                {"title": "Spa", "description": "Cabines duo et hammam.", "display_mode": "consult_only"},
            ],
            "room_types": [
                {"id": "soluxe-deluxe", "name": "Deluxe Business", "description": "Suite compacte design.", "night_price": 210000, "capacity": 2, "amenities": ["WiFi", "Bureau", "Piscine"], "photo_urls": ["https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1400&q=80"], "deposit_amount": 65000},
                {"id": "soluxe-executive", "name": "Executive Corner Suite", "description": "Coin salon et mini-bar.", "night_price": 290000, "capacity": 3, "amenities": ["Spa", "WiFi", "Mini-bar"], "photo_urls": ["https://images.unsplash.com/photo-1595576508898-0ad5c879a061?auto=format&fit=crop&w=1400&q=80"], "deposit_amount": 90000},
                {"id": "soluxe-imperial", "name": "Imperial Residence", "description": "Residence privee.", "night_price": 430000, "capacity": 4, "amenities": ["Transfert VIP", "Spa", "Terrasse"], "photo_urls": ["https://images.unsplash.com/photo-1590490359683-658d3d23f972?auto=format&fit=crop&w=1400&q=80"], "deposit_amount": 130000},
            ],
            "deposit_payment_method": "amana",
            "deposit_amount": 65000,
            "accepts_hotel_bookings": True,
        },
        "products": [],
    },
    {
        "full_name": "Direction Grand Hotel du Fleuve",
        "email": "demo.fleuve@amazer.demo",
        "phone": "+22790001003",
        "profile": {
            "business_name": "Grand Hotel du Fleuve",
            "phone": "+22790001003",
            "city": "Niamey",
            "address": "Corniche du Fleuve, quartier Gaweye",
            "activity_type": "hotel",
            "storefront_tier": "premium",
            "description": "Adresse rive-droite pour sejours loisirs et evenements premium, vue fleuve.",
            "logo_url": "https://placehold.co/256x256/111827/f59e0b/png?text=GF",
            "cover_image_url": "https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1600&q=80",
            "opening_hours": "Reception 24h/24",
            "whatsapp_contact": "+22790001003",
            "contact_email": "contact@grandhotelfleuve.demo",
            "gallery_images": [
                "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1600&q=80",
                "https://images.unsplash.com/photo-1578898887932-dce23a595ad4?auto=format&fit=crop&w=1600&q=80",
                "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1600&q=80",
            ],
            "service_offerings": [
                {"title": "Piscine", "description": "Piscine rooftop.", "display_mode": "consult_only"},
                {"title": "WiFi", "description": "Connexion stable.", "display_mode": "consult_only"},
                {"title": "Restaurant", "description": "Brasserie chic.", "display_mode": "consult_only"},
                {"title": "Spa", "description": "Spa holistique.", "display_mode": "consult_only"},
            ],
            "room_types": [
                {"id": "fleuve-deluxe", "name": "Deluxe Horizon", "description": "Vue partielle sur le fleuve.", "night_price": 185000, "capacity": 2, "amenities": ["WiFi", "Piscine", "Smart TV"], "photo_urls": ["https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1400&q=80"], "deposit_amount": 55000},
                {"id": "fleuve-suite", "name": "Suite Panorama", "description": "Salon prive et marbre.", "night_price": 265000, "capacity": 3, "amenities": ["Spa", "Restaurant", "Late checkout"], "photo_urls": ["https://images.unsplash.com/photo-1578898887932-dce23a595ad4?auto=format&fit=crop&w=1400&q=80"], "deposit_amount": 80000},
                {"id": "fleuve-royal", "name": "Royal River Suite", "description": "Terrasse sur le fleuve.", "night_price": 390000, "capacity": 4, "amenities": ["Terrasse", "Spa", "Transfert VIP"], "photo_urls": ["https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1400&q=80"], "deposit_amount": 120000},
            ],
            "deposit_payment_method": "nita",
            "deposit_amount": 55000,
            "accepts_hotel_bookings": True,
        },
        "products": [],
    },
    {
        "full_name": "Curatrice Touareg Chic",
        "email": "demo.touaregchic@amazer.demo",
        "phone": "+22790002001",
        "profile": {
            "business_name": "Boutique Touareg Chic",
            "phone": "+22790002001",
            "city": "Niamey",
            "address": "Plateau, galerie artisanale premium",
            "activity_type": "shop",
            "storefront_tier": "premium",
            "description": "Maison de selection pour artisanat d'exception, bijoux argent et cuir noble.",
            "logo_url": "https://placehold.co/256x256/0f172a/f97316/png?text=TC",
            "cover_image_url": "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=1600&q=80",
            "opening_hours": "Lun-Sam 09:00-20:00",
            "whatsapp_contact": "+22790002001",
            "contact_email": "bonjour@touaregchic.demo",
            "gallery_images": [
                "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1600&q=80",
                "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1600&q=80",
                "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1600&q=80",
            ],
            "service_offerings": [
                {"title": "Packaging Cadeau", "description": "Mise en coffret luxe.", "display_mode": "consult_only"},
                {"title": "Selection Artisanale", "description": "Pieces rares d'Agadez.", "display_mode": "consult_only"},
                {"title": "Livraison Premium", "description": "Livraison sur rendez-vous.", "display_mode": "consult_only"},
            ],
        },
        "products": [
            {"name": "Collier Argent Agadez", "brand": "Touareg Chic", "description": "Piece signature en argent brosse.", "category_slug": "accessoires", "amount": 85000, "promo_amount": 79000, "stock_quantity": 6, "image_url": "https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=1200&q=80", "is_sponsored": True, "is_boosted": True},
            {"name": "Sac Cuir Tannage Sahara", "brand": "Touareg Chic", "description": "Sac premium en cuir pleine fleur.", "category_slug": "accessoires", "amount": 125000, "stock_quantity": 4, "image_url": "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1200&q=80", "is_boosted": True},
            {"name": "Tapis Tisse Main Ayer", "brand": "Touareg Chic", "description": "Tapis deco tisse main.", "category_slug": "accessoires", "amount": 98000, "stock_quantity": 3, "image_url": "https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=1200&q=80"},
        ],
    },
    {
        "full_name": "Directeur Niamey Tech Hub",
        "email": "demo.techhub@amazer.demo",
        "phone": "+22790002002",
        "profile": {
            "business_name": "Niamey Tech Hub",
            "phone": "+22790002002",
            "city": "Niamey",
            "address": "Centre-ville, district innovation",
            "activity_type": "shop",
            "storefront_tier": "premium",
            "description": "Concept-store high-tech pour smartphones, audio premium et accessoires mobile-first.",
            "logo_url": "https://placehold.co/256x256/111827/22d3ee/png?text=TH",
            "cover_image_url": "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1600&q=80",
            "opening_hours": "Lun-Sam 09:30-21:00",
            "whatsapp_contact": "+22790002002",
            "contact_email": "sales@niameytechhub.demo",
            "gallery_images": [
                "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1600&q=80",
                "https://images.unsplash.com/photo-1512499617640-c74ae3a79d37?auto=format&fit=crop&w=1600&q=80",
                "https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=1600&q=80",
            ],
            "service_offerings": [
                {"title": "Configuration Express", "description": "Migration et installation jour J.", "display_mode": "consult_only"},
                {"title": "Garantie Pro", "description": "Assistance prioritaire.", "display_mode": "consult_only"},
                {"title": "Livraison Same Day", "description": "Livraison rapide a Niamey.", "display_mode": "consult_only"},
            ],
        },
        "products": [
            {"name": "iPhone 16 Pro Titan Desert", "brand": "Apple", "description": "Flagship premium 256 GB.", "category_slug": "technologie", "amount": 925000, "promo_amount": 899000, "stock_quantity": 8, "image_url": "https://images.unsplash.com/photo-1695048133142-1a20484cdee8?auto=format&fit=crop&w=1200&q=80", "is_sponsored": True, "is_boosted": True},
            {"name": "Galaxy S25 Ultra Carbon", "brand": "Samsung", "description": "Grand capteur et stylet.", "category_slug": "technologie", "amount": 875000, "stock_quantity": 7, "image_url": "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=1200&q=80", "is_boosted": True},
            {"name": "AirPods Pro USB-C", "brand": "Apple", "description": "Audio spatial et reduction de bruit.", "category_slug": "technologie", "amount": 185000, "stock_quantity": 12, "image_url": "https://images.unsplash.com/photo-1606220588913-b3aacb4d2f37?auto=format&fit=crop&w=1200&q=80"},
        ],
    },
    {
        "full_name": "Maison Niger Gourmet",
        "email": "demo.nigergourmet@amazer.demo",
        "phone": "+22790002003",
        "profile": {
            "business_name": "Niger Gourmet",
            "phone": "+22790002003",
            "city": "Niamey",
            "address": "Quartier Plateau, maison gourmet",
            "activity_type": "shop",
            "storefront_tier": "premium",
            "description": "Epicerie fine sahelienne avec epices rares, coffrets signatures et sourcing soigne.",
            "logo_url": "https://placehold.co/256x256/1c1917/f59e0b/png?text=NG",
            "cover_image_url": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1600&q=80",
            "opening_hours": "Lun-Dim 10:00-22:00",
            "whatsapp_contact": "+22790002003",
            "contact_email": "atelier@nigergourmet.demo",
            "gallery_images": [
                "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1600&q=80",
                "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1600&q=80",
                "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=1600&q=80",
            ],
            "service_offerings": [
                {"title": "Coffrets Signature", "description": "Assemblages cadeaux.", "display_mode": "consult_only"},
                {"title": "Sourcing Rare", "description": "Lots limites et terroirs rares.", "display_mode": "consult_only"},
                {"title": "Livraison Fraiche", "description": "Preparation soignee le jour meme.", "display_mode": "consult_only"},
            ],
        },
        "products": [
            {"name": "Safran du Tamesna Reserve", "brand": "Niger Gourmet", "description": "Safran premium en micro-lot.", "category_slug": "alimentation", "amount": 39000, "promo_amount": 35000, "stock_quantity": 15, "image_url": "https://images.unsplash.com/photo-1615485500834-bc10199bc727?auto=format&fit=crop&w=1200&q=80", "is_sponsored": True, "is_boosted": True},
            {"name": "Poivre du Desert Noir", "brand": "Niger Gourmet", "description": "Assemblage intense aux notes boisees.", "category_slug": "alimentation", "amount": 22000, "stock_quantity": 18, "image_url": "https://images.unsplash.com/photo-1599909534688-3f5f5d246f32?auto=format&fit=crop&w=1200&q=80"},
            {"name": "Coffret Epices Signature Sahel", "brand": "Niger Gourmet", "description": "Coffret cadeau haut de gamme.", "category_slug": "alimentation", "amount": 47000, "stock_quantity": 10, "image_url": "https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=1200&q=80", "is_boosted": True},
        ],
    },
    {
        "full_name": "Direction Amazer Premium Market",
        "email": "demo.amazer.market@amazer.demo",
        "phone": "+22790002006",
        "profile": {
            "business_name": "Amazer",
            "phone": "+22790002006",
            "city": "Niamey",
            "address": "Plateau, avenue du Grand Marche Premium",
            "activity_type": "shop",
            "storefront_tier": "premium",
            "description": "Grande alimentation premium et epicerie chic avec produits frais, cave fine, rayon bebe et selections du quotidien haut de gamme.",
            "logo_url": "https://placehold.co/256x256/7c2d12/fbbf24/png?text=AM",
            "cover_image_url": "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1600&q=80",
            "opening_hours": "Lun-Dim 08:00-23:00",
            "whatsapp_contact": "+22790002006",
            "contact_email": "premium@amazer.demo",
            "gallery_images": [
                "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1600&q=80",
                "https://images.unsplash.com/photo-1516594798947-e65505dbb29d?auto=format&fit=crop&w=1600&q=80",
                "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1600&q=80",
            ],
            "service_offerings": [
                {"title": "Epicerie Premium", "description": "Grandes marques, import selectif et rayons du quotidien.", "display_mode": "consult_only"},
                {"title": "Livraison Fraiche", "description": "Preparation express avec produits frais.", "display_mode": "consult_only"},
                {"title": "Cave & Coffrets", "description": "Coffrets cadeaux, cave fine et paniers premium.", "display_mode": "consult_only"},
                {"title": "Courses WhatsApp", "description": "Panier assiste pour familles et entreprises.", "display_mode": "consult_only"},
            ],
        },
        "products": [
            {"name": "Panier Epicerie Signature Amazer", "brand": "Amazer Market", "description": "Selection complete premium pour la semaine: cafe, pate, sauces et douceurs.", "category_slug": "alimentation", "amount": 42000, "promo_amount": 39000, "stock_quantity": 24, "image_url": "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80", "is_sponsored": True, "is_boosted": True},
            {"name": "Huile d'Olive Reserve Mediterranee", "brand": "Amazer Market", "description": "Huile premium extra vierge en bouteille design.", "category_slug": "alimentation", "amount": 14500, "stock_quantity": 40, "image_url": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=1200&q=80", "is_boosted": True},
            {"name": "Pack Petit-Dejeuner Luxe", "brand": "Amazer Market", "description": "Cafe moulu, miel, confiture artisanale et cereales premium.", "category_slug": "alimentation", "amount": 26500, "stock_quantity": 18, "image_url": "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=1200&q=80"},
            {"name": "Selection Fruits Frais Plateau", "brand": "Amazer Market", "description": "Corbeille premium de fruits frais pour maison ou bureau.", "category_slug": "alimentation", "amount": 18000, "stock_quantity": 30, "image_url": "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=1200&q=80"},
        ],
    },
    {
        "full_name": "Direction Fragrance Maison",
        "email": "demo.fragrance@amazer.demo",
        "phone": "+22790002007",
        "profile": {
            "business_name": "Fragrance",
            "phone": "+22790002007",
            "city": "Niamey",
            "address": "Plateau, galerie beaute & parfum",
            "activity_type": "shop",
            "storefront_tier": "premium",
            "description": "Maison parfum premium pour parfums, sprays d'interieur, coffrets cadeaux et soins parfumes selectionnes avec elegance.",
            "logo_url": "https://placehold.co/256x256/4c1d95/fbcfe8/png?text=FR",
            "cover_image_url": "https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=1600&q=80",
            "opening_hours": "Lun-Sam 10:00-21:00",
            "whatsapp_contact": "+22790002007",
            "contact_email": "bonjour@fragrance.demo",
            "gallery_images": [
                "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=1600&q=80",
                "https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=1600&q=80",
                "https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=1600&q=80",
            ],
            "service_offerings": [
                {"title": "Conseil Parfum", "description": "Selection personnalisee selon le style et l'occasion.", "display_mode": "consult_only"},
                {"title": "Coffret Cadeau", "description": "Presentation premium pour cadeaux et ceremonies.", "display_mode": "consult_only"},
                {"title": "Maison & Bougies", "description": "Diffuseurs, bougies et parfums d'interieur.", "display_mode": "consult_only"},
            ],
        },
        "products": [
            {"name": "Extrait Oud Prestige 100ml", "brand": "Fragrance", "description": "Parfum intense boise et ambre, flacon signature.", "category_slug": "accessoires", "amount": 89000, "promo_amount": 82000, "stock_quantity": 14, "image_url": "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=1200&q=80", "is_sponsored": True, "is_boosted": True},
            {"name": "Brume Rose Noire", "brand": "Fragrance", "description": "Brume elegante pour corps et textile premium.", "category_slug": "accessoires", "amount": 24000, "stock_quantity": 26, "image_url": "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=1200&q=80", "is_boosted": True},
            {"name": "Bougie Signature Ambre Santal", "brand": "Fragrance", "description": "Bougie parfumee haut de gamme pour interieur chic.", "category_slug": "accessoires", "amount": 19500, "stock_quantity": 22, "image_url": "https://images.unsplash.com/photo-1602874801006-66d98f8ff269?auto=format&fit=crop&w=1200&q=80"},
            {"name": "Coffret Luxe Fragrance Duo", "brand": "Fragrance", "description": "Coffret cadeau avec parfum et brume assortie.", "category_slug": "accessoires", "amount": 56000, "stock_quantity": 12, "image_url": "https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=1200&q=80"},
        ],
    },
    {
        "full_name": "Direction Azalai Grand Resort",
        "email": "demo.azalai@amazer.demo",
        "phone": "+22790001004",
        "profile": {
            "business_name": "Azalai Grand Resort",
            "phone": "+22790001004",
            "city": "Niamey",
            "address": "Quartier Koira Kano, avenue des resorts",
            "activity_type": "hotel",
            "storefront_tier": "premium",
            "description": "Resort urbain premium avec spa, lounges privees et conciergerie 24/7.",
            "logo_url": "https://placehold.co/256x256/1e293b/38bdf8/png?text=AZ",
            "cover_image_url": "https://images.unsplash.com/photo-1501117716987-c8e1ecb210d1?auto=format&fit=crop&w=1600&q=80",
            "opening_hours": "Reception 24h/24",
            "whatsapp_contact": "+22790001004",
            "contact_email": "contact@azalairesort.demo",
            "gallery_images": [
                "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1600&q=80",
                "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1600&q=80",
                "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1600&q=80",
            ],
            "service_offerings": [
                {"title": "Spa", "description": "Soins signature et hammam.", "display_mode": "consult_only"},
                {"title": "Piscine", "description": "Piscine lounge privee.", "display_mode": "consult_only"},
                {"title": "Coworking", "description": "Salons business connectes.", "display_mode": "consult_only"},
                {"title": "Navette VIP", "description": "Transfert aeroport.", "display_mode": "consult_only"},
            ],
            "room_types": [
                {"id": "azalai-deluxe", "name": "Deluxe Garden", "description": "Vue jardins privatifs.", "night_price": 205000, "capacity": 2, "amenities": ["Spa", "WiFi", "Piscine"], "photo_urls": ["https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1400&q=80"], "deposit_amount": 65000},
                {"id": "azalai-suite", "name": "Suite Prestige", "description": "Salon prive et concierge.", "night_price": 315000, "capacity": 3, "amenities": ["Conciergerie", "Spa", "Terrasse"], "photo_urls": ["https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1400&q=80"], "deposit_amount": 95000},
                {"id": "azalai-villa", "name": "Villa Executive", "description": "Villa avec piscine privee.", "night_price": 470000, "capacity": 4, "amenities": ["Piscine privee", "Chef prive", "Navette VIP"], "photo_urls": ["https://images.unsplash.com/photo-1501117716987-c8e1ecb210d1?auto=format&fit=crop&w=1400&q=80"], "deposit_amount": 140000},
            ],
            "deposit_payment_method": "nita",
            "deposit_amount": 65000,
            "accepts_hotel_bookings": True,
        },
        "products": [],
    },
    {
        "full_name": "Direction Sahel Palace Residences",
        "email": "demo.sahelpalace@amazer.demo",
        "phone": "+22790001005",
        "profile": {
            "business_name": "Sahel Palace Residences",
            "phone": "+22790001005",
            "city": "Niamey",
            "address": "Plateau, residencies signature",
            "activity_type": "hotel",
            "storefront_tier": "premium",
            "description": "Residences premium avec suites familiales, restaurant prive et experiences sur mesure.",
            "logo_url": "https://placehold.co/256x256/0f172a/facc15/png?text=SP",
            "cover_image_url": "https://images.unsplash.com/photo-1505691723518-36a5ac3be353?auto=format&fit=crop&w=1600&q=80",
            "opening_hours": "Reception 24h/24",
            "whatsapp_contact": "+22790001005",
            "contact_email": "welcome@sahelpalace.demo",
            "gallery_images": [
                "https://images.unsplash.com/photo-1505691723518-36a5ac3be353?auto=format&fit=crop&w=1600&q=80",
                "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1600&q=80",
                "https://images.unsplash.com/photo-1505691723518-36a5ac3be353?auto=format&fit=crop&w=1600&q=80",
            ],
            "service_offerings": [
                {"title": "Chef prive", "description": "Menus degustation sur place.", "display_mode": "consult_only"},
                {"title": "Spa", "description": "Cabines duo premium.", "display_mode": "consult_only"},
                {"title": "Kids Club", "description": "Services familles.", "display_mode": "consult_only"},
                {"title": "Room Service", "description": "Service 24/7.", "display_mode": "consult_only"},
            ],
            "room_types": [
                {"id": "sahel-classic", "name": "Residence Classic", "description": "Suite familiale.", "night_price": 180000, "capacity": 3, "amenities": ["Kitchenette", "WiFi", "Kids Club"], "photo_urls": ["https://images.unsplash.com/photo-1505691723518-36a5ac3be353?auto=format&fit=crop&w=1400&q=80"], "deposit_amount": 60000},
                {"id": "sahel-family", "name": "Family Signature", "description": "Deux chambres et salon.", "night_price": 265000, "capacity": 4, "amenities": ["Salon", "Room Service", "Piscine"], "photo_urls": ["https://images.unsplash.com/photo-1505691723518-36a5ac3be353?auto=format&fit=crop&w=1400&q=80"], "deposit_amount": 85000},
                {"id": "sahel-penthouse", "name": "Penthouse Sahel", "description": "Terrasse panoramique.", "night_price": 415000, "capacity": 4, "amenities": ["Chef prive", "Spa", "Terrasse"], "photo_urls": ["https://images.unsplash.com/photo-1505691723518-36a5ac3be353?auto=format&fit=crop&w=1400&q=80"], "deposit_amount": 125000},
            ],
            "deposit_payment_method": "amana",
            "deposit_amount": 60000,
            "accepts_hotel_bookings": True,
        },
        "products": [],
    },
    {
        "full_name": "Directrice Studio Sahara Mode",
        "email": "demo.saharamode@amazer.demo",
        "phone": "+22790002004",
        "profile": {
            "business_name": "Studio Sahara Mode",
            "phone": "+22790002004",
            "city": "Niamey",
            "address": "Plateau, galerie mode contemporaine",
            "activity_type": "shop",
            "storefront_tier": "premium",
            "description": "Boutique mode et accessoires premium inspires du Sahel.",
            "logo_url": "https://placehold.co/256x256/0f172a/ec4899/png?text=SM",
            "cover_image_url": "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1600&q=80",
            "opening_hours": "Lun-Sam 10:00-20:30",
            "whatsapp_contact": "+22790002004",
            "contact_email": "hello@saharamode.demo",
            "gallery_images": [
                "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1600&q=80",
                "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1600&q=80",
                "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1600&q=80",
            ],
            "service_offerings": [
                {"title": "Conseil Style", "description": "Session lookbook sur mesure.", "display_mode": "consult_only"},
                {"title": "Customisation", "description": "Broderie et ajustements.", "display_mode": "consult_only"},
                {"title": "Livraison Express", "description": "Livraison en 2h Niamey.", "display_mode": "consult_only"},
            ],
        },
        "products": [
            {"name": "Veste Nomade Signature", "brand": "Studio Sahara", "description": "Veste lin premium coupe moderne.", "category_slug": "accessoires", "amount": 78000, "stock_quantity": 9, "image_url": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80", "is_boosted": True},
            {"name": "Sac Heritage Sahel", "brand": "Studio Sahara", "description": "Sac cuir souple et finitions artisanales.", "category_slug": "accessoires", "amount": 92000, "promo_amount": 88000, "stock_quantity": 6, "image_url": "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1200&q=80", "is_sponsored": True},
            {"name": "Lunettes Solar Mirage", "brand": "Studio Sahara", "description": "Monture premium UV400.", "category_slug": "accessoires", "amount": 36000, "stock_quantity": 14, "image_url": "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=1200&q=80"},
        ],
    },
    {
        "full_name": "Maison Kiffa Bio",
        "email": "demo.kiffabio@amazer.demo",
        "phone": "+22790002005",
        "profile": {
            "business_name": "Maison Kiffa Bio",
            "phone": "+22790002005",
            "city": "Niamey",
            "address": "Quartier Lazaret, atelier bio",
            "activity_type": "shop",
            "storefront_tier": "premium",
            "description": "Boutique alimentation saine avec produits bio et infusions locales.",
            "logo_url": "https://placehold.co/256x256/14532d/86efac/png?text=KB",
            "cover_image_url": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1600&q=80",
            "opening_hours": "Lun-Dim 08:00-21:00",
            "whatsapp_contact": "+22790002005",
            "contact_email": "bonjour@kiffabio.demo",
            "gallery_images": [
                "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1600&q=80",
                "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=1600&q=80",
                "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1600&q=80",
            ],
            "service_offerings": [
                {"title": "Atelier nutrition", "description": "Conseil nutritionnel.", "display_mode": "consult_only"},
                {"title": "Livraison Fraiche", "description": "Livraison a domicile.", "display_mode": "consult_only"},
                {"title": "Box Hebdo", "description": "Box produits saisonniers.", "display_mode": "consult_only"},
            ],
        },
        "products": [
            {"name": "Granola Baobab Energy", "brand": "Kiffa Bio", "description": "Granola artisanal et baobab.", "category_slug": "alimentation", "amount": 14000, "stock_quantity": 20, "image_url": "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=1200&q=80", "is_boosted": True},
            {"name": "Infusion Moringa Detox", "brand": "Kiffa Bio", "description": "Infusion locale detox.", "category_slug": "alimentation", "amount": 9000, "promo_amount": 7500, "stock_quantity": 30, "image_url": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80", "is_sponsored": True},
            {"name": "Miel Sahel Or", "brand": "Kiffa Bio", "description": "Miel brut premium.", "category_slug": "alimentation", "amount": 18000, "stock_quantity": 16, "image_url": "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1200&q=80"},
        ],
    },
]


def main() -> None:
    db = SessionLocal()
    try:
        active_data = [item for item in DATA if item["email"] in ACTIVE_DEMO_EMAILS]
        categories = {
            "accessoires": ensure_category(db, "accessoires", "Accessoires"),
            "technologie": ensure_category(db, "technologie", "Technologie"),
            "alimentation": ensure_category(db, "alimentation", "Alimentation"),
        }
        for item in active_data:
            user = ensure_user(db, item["email"], item["full_name"], item["phone"])
            profile = ensure_profile(db, user, item["profile"])
            vendor = db.get(Vendor, profile.vendor_id)
            if vendor is None:
                raise RuntimeError(f"Vendor missing for {profile.business_name}")
            for product in item["products"]:
                ensure_product(db, vendor.id, categories[product["category_slug"]].id, product)
        db.commit()
        print("Demo storefront seed termine.")
        print(f"- Storefronts: {len(active_data)}")
        print(f"- Password: {COMMON_PASSWORD}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
