"""add marketplace vendor category price history and search indexes

Revision ID: 69bf07fdd8c9
Revises: a6fbc5a19d10
Create Date: 2026-02-26 17:26:54.490824
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "69bf07fdd8c9"
down_revision: str | None = "a6fbc5a19d10"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DEFAULT_VENDOR_ID = "00000000-0000-0000-0000-000000000001"


def upgrade() -> None:
    op.create_table(
        "categories",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("slug", sa.String(length=140), nullable=False),
        sa.Column("parent_id", sa.String(length=36), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["parent_id"], ["categories.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_categories_parent_id"), "categories", ["parent_id"], unique=False)
    op.create_index(op.f("ix_categories_slug"), "categories", ["slug"], unique=True)

    op.create_table(
        "vendors",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("slug", sa.String(length=140), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_vendors_slug"), "vendors", ["slug"], unique=True)

    op.execute(
        f"""
        INSERT INTO vendors (id, name, slug, is_active)
        VALUES ('{DEFAULT_VENDOR_ID}', 'Default Vendor', 'default-vendor', true)
        ON CONFLICT (id) DO NOTHING
        """
    )

    op.add_column("prices", sa.Column("vendor_id", sa.String(length=36), nullable=True))
    op.execute(
        f"""
        UPDATE prices
        SET vendor_id = '{DEFAULT_VENDOR_ID}'
        WHERE vendor_id IS NULL
        """
    )
    op.alter_column("prices", "vendor_id", nullable=False)
    op.create_index(op.f("ix_prices_vendor_id"), "prices", ["vendor_id"], unique=False)
    op.create_foreign_key(
        "fk_prices_vendor_id",
        "prices",
        "vendors",
        ["vendor_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_check_constraint("ck_prices_amount_positive", "prices", "amount > 0")
    op.create_check_constraint("ck_prices_stock_non_negative", "prices", "stock_quantity >= 0")
    op.create_index(
        "ix_prices_active_stock",
        "prices",
        ["is_active", "stock_quantity"],
        unique=False,
    )

    op.create_table(
        "price_history",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("price_id", sa.String(length=36), nullable=False),
        sa.Column("previous_amount", sa.Float(), nullable=False),
        sa.Column("new_amount", sa.Float(), nullable=False),
        sa.Column("previous_stock_quantity", sa.Integer(), nullable=False),
        sa.Column("new_stock_quantity", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column(
            "changed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["price_id"], ["prices.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_price_history_price_id"), "price_history", ["price_id"], unique=False)

    op.add_column("products", sa.Column("category_id", sa.String(length=36), nullable=True))
    op.create_index(op.f("ix_products_category_id"), "products", ["category_id"], unique=False)
    op.create_foreign_key(
        "fk_products_category_id",
        "products",
        "categories",
        ["category_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute("CREATE INDEX IF NOT EXISTS ix_products_specs_gin ON products USING GIN (specs)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_products_name_trgm ON products USING GIN (name gin_trgm_ops)"
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_products_brand_trgm
        ON products USING GIN (brand gin_trgm_ops)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_products_search_tsv
        ON products USING GIN (
            to_tsvector('simple', COALESCE(name, '') || ' ' || COALESCE(brand, ''))
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_products_search_tsv")
    op.execute("DROP INDEX IF EXISTS ix_products_brand_trgm")
    op.execute("DROP INDEX IF EXISTS ix_products_name_trgm")
    op.execute("DROP INDEX IF EXISTS ix_products_specs_gin")

    op.drop_constraint("fk_products_category_id", "products", type_="foreignkey")
    op.drop_index(op.f("ix_products_category_id"), table_name="products")
    op.drop_column("products", "category_id")

    op.drop_index(op.f("ix_price_history_price_id"), table_name="price_history")
    op.drop_table("price_history")

    op.drop_index("ix_prices_active_stock", table_name="prices")
    op.drop_constraint("ck_prices_stock_non_negative", "prices", type_="check")
    op.drop_constraint("ck_prices_amount_positive", "prices", type_="check")
    op.drop_constraint("fk_prices_vendor_id", "prices", type_="foreignkey")
    op.drop_index(op.f("ix_prices_vendor_id"), table_name="prices")
    op.drop_column("prices", "vendor_id")

    op.drop_index(op.f("ix_vendors_slug"), table_name="vendors")
    op.drop_table("vendors")

    op.drop_index(op.f("ix_categories_slug"), table_name="categories")
    op.drop_index(op.f("ix_categories_parent_id"), table_name="categories")
    op.drop_table("categories")
