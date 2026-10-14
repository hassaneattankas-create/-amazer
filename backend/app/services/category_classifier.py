"""Classement automatique d'un produit dans une categorie a partir de son nom.

Les vendeurs publient souvent sans choisir de categorie : les filtres de l'accueil restaient vides.
On devine la categorie par mots-cles (simple, previsible, sans service externe). Un choix explicite
du vendeur ou de l'admin n'est jamais ecrase.
"""

import logging
import re
import unicodedata

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.product import Product

logger = logging.getLogger(__name__)

# Ordre important : la premiere categorie qui correspond l'emporte.
KEYWORDS: dict[str, tuple[str, ...]] = {
    "technologie": (
        "ordinateur", "laptop", "pc", "macbook", "imprimante", "clavier", "souris", "disque dur", "ssd",
        "cle usb", "routeur", "modem", "tablette tactile", "ipad", "console", "playstation", "xbox", "camera",
    ),
    "electronique": (
        "telephone", "smartphone", "iphone", "samsung", "tecno", "itel", "infinix", "redmi", "xiaomi",
        "huawei", "oppo", "nokia", "television", "tv", "ecouteur", "airpods", "chargeur", "batterie externe",
        "power bank", "enceinte", "montre connectee", "ventilateur", "climatiseur", "refrigerateur", "frigo",
        "congelateur", "micro-onde", "mixeur", "blender", "fer a repasser",
    ),
    "hygiene": (
        "savon", "javel", "detergent", "lessive", "omo", "insecticide", "mouchoir", "mouchoirs", "papier toilette",
        "dentifrice", "brosse a dent", "shampoing", "shampooing", "deodorant", "creme corporelle", "lotion", "parfum",
        "couche", "serviette hygienique", "nettoyant", "cleaner", "ajax", "recurer", "desinfectant", "gel douche",
    ),
    "maison": (
        "papier aluminium", "film etirable", "cling film", "barquette", "serviettes de table", "assiette",
        "verre", "tasse", "marmite", "casserole", "poele", "seau", "balai", "matelas", "drap", "oreiller",
        "rideau", "chaise", "table", "meuble", "lampe", "ampoule", "couverts", "thermos", "glaciere",
    ),
    "accessoires": (
        "sac", "montre", "lunettes", "ceinture", "bijou", "collier", "bracelet", "bague", "portefeuille",
        "chaussure", "basket", "sandale", "casquette", "chapeau", "pagne", "boubou", "robe", "chemise",
        "pantalon", "t-shirt", "tee-shirt", "jeans", "valise", "coque", "etui",
    ),
    "alimentation": (
        "riz", "pate", "pates", "spaghetti", "macaroni", "couscous", "nouilles", "indomie", "the", "cafe",
        "sucre", "sel", "lait", "nido", "farine", "huile", "beurre", "mayonnaise", "ketchup", "tomate",
        "sardine", "sardines", "thon", "conserve", "petits pois", "olives", "betterave", "betteraves", "legumes", "maggi", "bouillon",
        "kadi", "jus", "eau minerale", "soda", "sprite", "coca", "fanta", "energy drink", "biscuit",
        "chocolat", "nesquik", "miel", "confiture", "tartiner", "spread", "cerelac", "phosphatine", "nan optipro",
        "france lait", "nutribom", "custard", "vinaigre", "arome", "epices", "edulcorant", "oeuf", "crevette", "crevettes",
        "poulet", "viande", "poisson", "fruit", "banane", "datte", "arachide", "mil", "sorgho", "haricot",
    ),
}


def _normalize(text: str) -> str:
    text = text.lower().replace("œ", "oe")
    without_accents = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return " " + re.sub(r"[^a-z0-9]+", " ", without_accents).strip() + " "


def guess_category_slug(name: str, description: str | None = None) -> str | None:
    """Slug de categorie devine a partir du nom (prioritaire) puis de la description."""
    for text in (name, description or ""):
        haystack = _normalize(text)
        if haystack.strip() == "":
            continue
        for slug, words in KEYWORDS.items():
            if any(f" {_normalize(word).strip()} " in haystack for word in words):
                return slug
    return None


def guess_category_id(db: Session, name: str, description: str | None = None) -> str | None:
    slug = guess_category_slug(name, description)
    if slug is None:
        return None
    return db.scalar(select(Category.id).where(Category.slug == slug, Category.is_active.is_(True)))


def assign_missing_categories(db: Session) -> int:
    """Range les produits sans categorie. Idempotent : ne touche jamais une categorie deja choisie."""
    category_ids = {slug: cid for slug, cid in db.execute(select(Category.slug, Category.id)).all()}
    if not category_ids:
        return 0
    updated = 0
    for product in db.scalars(select(Product).where(Product.category_id.is_(None))).all():
        slug = guess_category_slug(product.name, product.description)
        if slug and slug in category_ids:
            product.category_id = category_ids[slug]
            updated += 1
    if updated:
        db.commit()
    return updated
