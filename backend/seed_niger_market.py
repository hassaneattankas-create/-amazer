from __future__ import annotations

import random
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app import models as _models  # noqa: F401
from app.database import SessionLocal
from app.models.category import Category
from app.models.price_history import PriceHistory
from app.models.product import Price, Product
from app.models.vendor import Vendor

RANDOM_SEED = 20260228
CURRENCY_XOF = "XOF"
TOTAL_PRODUCTS = 50
VENDORS_PER_PRODUCT = 3
DAYS_OF_HISTORY = 7
SEED_TAG = "seed_niger_market_v1"


@dataclass(frozen=True)
class ProductTemplate:
    name: str
    brand: str
    category_slug: str
    base_price_xof: int
    description: str
    specs: dict[str, str]


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def get_or_create_category(db: Session, *, name: str, slug: str) -> Category:
    category = db.scalar(select(Category).where(Category.slug == slug))
    if category is not None:
        return category

    category = Category(name=name, slug=slug, is_active=True)
    db.add(category)
    db.flush()
    return category


def get_or_create_vendor(db: Session, *, name: str) -> Vendor:
    slug = slugify(name)
    vendor = db.scalar(select(Vendor).where(Vendor.slug == slug))
    if vendor is not None:
        return vendor

    vendor = Vendor(name=name, slug=slug, is_active=True)
    db.add(vendor)
    db.flush()
    return vendor


def get_or_create_product(
    db: Session,
    *,
    template: ProductTemplate,
    index: int,
    category_id: str,
) -> Product:
    product_name = f"{template.name} - Serie {index + 1:02d}"
    product = db.scalar(
        select(Product).where(
            and_(
                Product.name == product_name,
                Product.brand == template.brand,
            )
        )
    )
    if product is not None:
        return product

    barcode = f"618{index + 1:010d}"
    specs = {
        **template.specs,
        "barcode": barcode,
        "origine": "Niger",
        "seed_source": SEED_TAG,
    }

    product = Product(
        name=product_name,
        brand=template.brand,
        description=template.description,
        category_id=category_id,
        specs=specs,
        main_image_url=f"https://picsum.photos/seed/amazer-{slugify(product_name)}/640/480",
    )
    db.add(product)
    db.flush()
    return product


def upsert_price_with_history(
    db: Session,
    *,
    product: Product,
    vendor: Vendor,
    base_price_xof: int,
    rng: random.Random,
) -> None:
    price = db.scalar(
        select(Price).where(
            and_(
                Price.product_id == product.id,
                Price.vendor_id == vendor.id,
            )
        )
    )

    if price is None:
        opening_price = float(max(100, base_price_xof + rng.randint(-3500, 3500)))
        opening_stock = max(5, 120 + rng.randint(-35, 45))
        price = Price(
            product_id=product.id,
            vendor_id=vendor.id,
            currency=CURRENCY_XOF,
            amount=opening_price,
            stock_quantity=opening_stock,
            is_active=True,
        )
        db.add(price)
        db.flush()

    existing_history_count = db.scalar(
        select(func.count()).select_from(PriceHistory).where(PriceHistory.price_id == price.id)
    )
    if existing_history_count and existing_history_count >= DAYS_OF_HISTORY:
        return

    current_amount = float(price.amount)
    current_stock = int(price.stock_quantity)
    base_date = now_utc() - timedelta(days=DAYS_OF_HISTORY - 1)

    for day in range(DAYS_OF_HISTORY):
        previous_amount = current_amount
        previous_stock = current_stock

        delta_price = rng.randint(-900, 1100)
        delta_stock = rng.randint(-8, 10)

        current_amount = float(max(100, previous_amount + delta_price))
        current_stock = max(0, previous_stock + delta_stock)

        history_entry = PriceHistory(
            price_id=price.id,
            previous_amount=float(previous_amount),
            new_amount=float(current_amount),
            previous_stock_quantity=int(previous_stock),
            new_stock_quantity=int(current_stock),
            reason="Mise a jour marche Niamey",
            changed_at=base_date + timedelta(days=day),
        )
        db.add(history_entry)

    price.amount = current_amount
    price.stock_quantity = current_stock
    price.currency = CURRENCY_XOF
    price.is_active = True
    db.add(price)


def build_product_templates() -> list[ProductTemplate]:
    return [
        ProductTemplate(
            name="Sac de Riz 25kg Birni N'Konni",
            brand="Riz Sahel",
            category_slug="alimentation",
            base_price_xof=14500,
            description="Riz local 25kg adapte aux besoins familiaux.",
            specs={"poids": "25kg", "type": "riz local"},
        ),
        ProductTemplate(
            name="Bidon d'Huile 5L Dinor",
            brand="Dinor",
            category_slug="alimentation",
            base_price_xof=8800,
            description="Huile vegetale 5 litres pour cuisine quotidienne.",
            specs={"volume": "5L", "matiere": "vegetale"},
        ),
        ProductTemplate(
            name="Carton de Pates Maman",
            brand="Maman",
            category_slug="alimentation",
            base_price_xof=7300,
            description="Carton de pates ideal pour restauration familiale.",
            specs={"contenu": "12 paquets", "type": "spaghetti"},
        ),
        ProductTemplate(
            name="Lait en poudre",
            brand="Nido",
            category_slug="alimentation",
            base_price_xof=5600,
            description="Lait en poudre enrichi pour usage quotidien.",
            specs={"poids": "2.5kg", "fortifie": "oui"},
        ),
        ProductTemplate(
            name="iPhone 15 Pro",
            brand="Apple",
            category_slug="electronique",
            base_price_xof=745000,
            description="Smartphone haut de gamme pour usage premium.",
            specs={"stockage": "256GB", "reseau": "5G"},
        ),
        ProductTemplate(
            name="Samsung Galaxy A54",
            brand="Samsung",
            category_slug="electronique",
            base_price_xof=235000,
            description="Smartphone milieu de gamme performant.",
            specs={"stockage": "128GB", "reseau": "5G"},
        ),
        ProductTemplate(
            name="Televiseur LG 43 pouces",
            brand="LG",
            category_slug="electronique",
            base_price_xof=198000,
            description="TV LED 43 pouces pour salon moderne.",
            specs={"taille": "43", "resolution": "FHD"},
        ),
        ProductTemplate(
            name="Panneau Solaire 200W",
            brand="SolarTech",
            category_slug="electronique",
            base_price_xof=112000,
            description="Panneau solaire monocristallin 200W.",
            specs={"puissance": "200W", "type": "monocristallin"},
        ),
        ProductTemplate(
            name="Batterie Gel 100Ah",
            brand="PowerPlus",
            category_slug="electronique",
            base_price_xof=126000,
            description="Batterie gel 12V 100Ah pour systeme solaire.",
            specs={"capacite": "100Ah", "voltage": "12V"},
        ),
        ProductTemplate(
            name="Ventilateur Binatone",
            brand="Binatone",
            category_slug="maison",
            base_price_xof=42000,
            description="Ventilateur robuste adapte a la chaleur de Niamey.",
            specs={"diametre": "16 pouces", "vitesse": "3 niveaux"},
        ),
        ProductTemplate(
            name="Climatiseur Split",
            brand="Midea",
            category_slug="maison",
            base_price_xof=286000,
            description="Climatiseur split economique en energie.",
            specs={"puissance": "1.5CV", "type": "inverter"},
        ),
        ProductTemplate(
            name="Refrigerateur",
            brand="Hisense",
            category_slug="maison",
            base_price_xof=258000,
            description="Refrigerateur familial grande capacite.",
            specs={"capacite": "300L", "classe": "A+"},
        ),
        ProductTemplate(
            name="Savon en poudre Omo",
            brand="Omo",
            category_slug="hygiene",
            base_price_xof=5800,
            description="Detergent en poudre pour linge quotidien.",
            specs={"poids": "5kg", "type": "linge"},
        ),
        ProductTemplate(
            name="Detergent Menager",
            brand="Ajax",
            category_slug="hygiene",
            base_price_xof=3600,
            description="Detergent polyvalent pour menage.",
            specs={"volume": "2L", "usage": "multi-surfaces"},
        ),
    ]


def main() -> None:
    rng = random.Random(RANDOM_SEED)
    db = SessionLocal()

    try:
        categories = {
            "alimentation": get_or_create_category(db, name="Alimentation", slug="alimentation"),
            "electronique": get_or_create_category(db, name="Electronique", slug="electronique"),
            "maison": get_or_create_category(db, name="Maison", slug="maison"),
            "hygiene": get_or_create_category(db, name="Hygiene", slug="hygiene"),
        }

        vendor_names = [
            "Grand Marche Habou-Bene",
            "Petit Marche Niamey",
            "Katako Electronique",
            "Boutique Al-Izza",
            "Supermarche Marina",
            "Niamey Mall",
            "Etablissements Malam Narao",
            "Sahara Distribution",
            "Comptoir Tanimoune",
            "Bazaar Wadata",
        ]
        vendors = [get_or_create_vendor(db, name=name) for name in vendor_names]

        templates = build_product_templates()
        seeded_products = 0

        for index in range(TOTAL_PRODUCTS):
            template = templates[index % len(templates)]
            category = categories[template.category_slug]
            product = get_or_create_product(
                db,
                template=template,
                index=index,
                category_id=category.id,
            )
            seeded_products += 1

            selected_vendors = rng.sample(vendors, k=VENDORS_PER_PRODUCT)
            for vendor in selected_vendors:
                upsert_price_with_history(
                    db,
                    product=product,
                    vendor=vendor,
                    base_price_xof=template.base_price_xof,
                    rng=rng,
                )

        db.commit()

        print("Seed Niger Market termine.")
        print(f"- Categories: {len(categories)}")
        print(f"- Vendeurs: {len(vendors)}")
        print(f"- Produits traites: {seeded_products}")
        print(
            f"- Historique prix: {DAYS_OF_HISTORY} jours x {VENDORS_PER_PRODUCT} vendeurs minimum par produit"
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
