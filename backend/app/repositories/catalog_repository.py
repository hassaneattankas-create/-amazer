from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.vendor import Vendor


class CatalogRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_active_categories(self, *, limit: int, offset: int) -> list[Category]:
        stmt = (
            select(Category)
            .where(Category.is_active.is_(True))
            .order_by(Category.name.asc())
            .offset(offset)
            .limit(limit)
        )
        return list(self.db.scalars(stmt))

    def list_active_vendors(self, *, limit: int, offset: int) -> list[Vendor]:
        stmt = (
            select(Vendor)
            .where(Vendor.is_active.is_(True))
            .order_by(Vendor.name.asc())
            .offset(offset)
            .limit(limit)
        )
        return list(self.db.scalars(stmt))
