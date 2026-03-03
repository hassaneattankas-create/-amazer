from __future__ import annotations

import os
from collections.abc import Iterable
from typing import Any

from sqlalchemy import create_engine, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, sessionmaker

from app import models as _models  # noqa: F401
from app.database import Base
from app.models.category import Category
from app.models.product import Price, Product, ProductImage
from app.models.vendor import Vendor


def _as_dict(obj: Any, *, columns: list[str]) -> dict[str, Any]:
    return {column: getattr(obj, column) for column in columns}


def _chunked(items: list[dict[str, Any]], size: int) -> Iterable[list[dict[str, Any]]]:
    for idx in range(0, len(items), size):
        yield items[idx : idx + size]


def copy_table(
    source_db: Session,
    target_db: Session,
    model: type[Any],
    *,
    conflict_key: str = "id",
    batch_size: int = 500,
) -> int:
    columns = [col.name for col in model.__table__.columns]  # type: ignore[attr-defined]
    rows = source_db.scalars(select(model)).all()
    payload = [_as_dict(row, columns=columns) for row in rows]
    if not payload:
        return 0

    inserted = 0
    table = model.__table__  # type: ignore[attr-defined]
    for batch in _chunked(payload, batch_size):
        stmt = insert(table).values(batch)
        stmt = stmt.on_conflict_do_nothing(index_elements=[conflict_key])
        result = target_db.execute(stmt)
        inserted += int(result.rowcount or 0)

    target_db.commit()
    return inserted


def main() -> None:
    source_url = os.getenv("SOURCE_DATABASE_URL")
    target_url = os.getenv("TARGET_DATABASE_URL")

    if not source_url or not target_url:
        raise RuntimeError(
            "SOURCE_DATABASE_URL and TARGET_DATABASE_URL are required. "
            "Example: SOURCE_DATABASE_URL=postgresql+psycopg://... TARGET_DATABASE_URL=postgresql+psycopg://..."
        )

    source_engine = create_engine(source_url, future=True, pool_pre_ping=True)
    target_engine = create_engine(target_url, future=True, pool_pre_ping=True)

    # Ensure remote schema exists before insertions.
    Base.metadata.create_all(target_engine)

    SourceSession = sessionmaker(bind=source_engine, autoflush=False, autocommit=False, expire_on_commit=False)
    TargetSession = sessionmaker(bind=target_engine, autoflush=False, autocommit=False, expire_on_commit=False)

    with SourceSession() as source_db, TargetSession() as target_db:
        summary: list[tuple[str, int]] = []

        # Order matters for foreign keys.
        summary.append(("categories", copy_table(source_db, target_db, Category)))
        summary.append(("vendors", copy_table(source_db, target_db, Vendor)))
        summary.append(("products", copy_table(source_db, target_db, Product)))
        summary.append(("product_images", copy_table(source_db, target_db, ProductImage)))
        summary.append(("prices", copy_table(source_db, target_db, Price)))

    print("Migration cloud terminee (Niamey catalog).")
    for table_name, inserted in summary:
        print(f"- {table_name}: {inserted} nouvelles lignes")


if __name__ == "__main__":
    main()
