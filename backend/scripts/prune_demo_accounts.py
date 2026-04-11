"""
Désactive les comptes de démo @amazer.demo sauf les vitrines conservées (Amazer Market, Fragrance, Le Sahel Rooftop).
Les comptes avec un email réel (hors @amazer.demo) ne sont pas touchés.

Usage (Render Shell ou machine avec accès DB) :
  cd backend
  export DATABASE_URL="postgresql://..."
  python -m scripts.prune_demo_accounts

Simulation sans écriture :
  python -m scripts.prune_demo_accounts --dry-run
"""

from __future__ import annotations

import argparse
import os
import sys

# Permet "python -m scripts.prune_demo_accounts" depuis backend/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, update  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.core.cache import cache_delete_prefixes  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models.seller_profile import SellerProfile  # noqa: E402
from app.models.user import User  # noqa: E402
from app.models.vendor import Vendor  # noqa: E402
from app.models.product import Price  # noqa: E402


# Conserver : boutique Amazer Market, Fragrance, restaurant Le Sahel Rooftop (voir seed_demo_*.py)
KEEP_DEMO_EMAILS = frozenset(
    {
        "demo.amazer.market@amazer.demo",
        "demo.fragrance@amazer.demo",
        "demo.sahelrooftop@amazer.demo",
    }
)


def _deactivate_demo_user(db, user: User, dry_run: bool) -> None:
    if not user.is_active:
        return
    if dry_run:
        print(f"  [dry-run] désactiverait: {user.email}")
        return
    user.is_active = False
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == user.id))
    if profile is not None:
        vendor = db.get(Vendor, profile.vendor_id)
        if vendor is not None:
            vendor.is_active = False
            db.execute(update(Price).where(Price.vendor_id == vendor.id).values(is_active=False))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Afficher les comptes concernés sans modifier la base.")
    args = parser.parse_args()

    if not os.environ.get("DATABASE_URL"):
        print("DATABASE_URL manquant.", file=sys.stderr)
        return 1

    settings = get_settings()
    admin_lower = settings.admin_email.strip().lower()
    keep = {e.lower() for e in KEEP_DEMO_EMAILS}
    keep.add(admin_lower)

    db = SessionLocal()
    try:
        stmt = select(User).where(User.email.ilike("%@amazer.demo"))
        rows = list(db.scalars(stmt).all())
        to_process = [u for u in rows if u.email.strip().lower() not in keep]

        print(f"Comptes @amazer.demo trouvés: {len(rows)} — à désactiver: {len(to_process)} — conservés: {sorted(keep)}")
        for u in to_process:
            _deactivate_demo_user(db, u, args.dry_run)

        if not args.dry_run and to_process:
            db.commit()
            cache_delete_prefixes("catalog:", "content:")
            print(f"OK: {len(to_process)} compte(s) désactivé(s), cache public invalidé.")
        elif args.dry_run:
            print("Dry-run terminé (aucune écriture).")
        else:
            print("Rien à désactiver.")
        return 0
    except Exception as exc:
        db.rollback()
        print(f"Erreur: {exc}", file=sys.stderr)
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
