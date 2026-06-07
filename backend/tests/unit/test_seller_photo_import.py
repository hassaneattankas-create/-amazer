import asyncio
import io
from types import SimpleNamespace
from unittest.mock import Mock

from PIL import Image
from starlette.datastructures import Headers
from starlette.datastructures import UploadFile as StarletteUploadFile

from app.routes import seller as seller_route


def _request() -> SimpleNamespace:
    return SimpleNamespace(
        client=SimpleNamespace(host="127.0.0.1"),
        url=SimpleNamespace(path="/seller/products/import-photos"),
    )


def _png_upload(filename: str) -> StarletteUploadFile:
    image = Image.new("RGB", (1600, 1200), (200, 120, 40))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    buffer.seek(0)
    return StarletteUploadFile(
        file=buffer,
        filename=filename,
        headers=Headers({"content-type": "image/png"}),
    )


def _patch_common(monkeypatch) -> None:
    monkeypatch.setattr(seller_route, "enforce_csrf", lambda _request: None)
    monkeypatch.setattr(seller_route, "append_audit_log", lambda *a, **k: None)
    monkeypatch.setattr(seller_route, "_invalidate_public_marketplace_cache", lambda: None)
    monkeypatch.setattr(seller_route, "_has_active_subscription", lambda _p: True)

    async def _fake_store(_data: bytes) -> str:
        return "/api/v1/media/file/fake.jpg"

    monkeypatch.setattr(seller_route, "_store_image_bytes", _fake_store)


def test_import_photos_creates_one_draft_product_per_photo(monkeypatch) -> None:
    _patch_common(monkeypatch)
    monkeypatch.setattr(seller_route, "is_premium_profile", lambda _p: True)

    profile = SimpleNamespace(vendor_id="vendor-1", activity_type="shop", storefront_tier="premium")
    vendor = SimpleNamespace(id="vendor-1", is_active=False)
    db = Mock()
    db.scalar.return_value = profile
    db.get.return_value = vendor

    added: list = []
    db.add.side_effect = lambda obj: added.append(obj)

    files = [_png_upload("riz_local.png"), _png_upload("huile.png")]
    result = asyncio.run(
        seller_route.import_product_photos(_request(), db, SimpleNamespace(id="user-1"), files)
    )

    assert result["created"] == 2
    # 2 produits + 2 prix
    assert len(added) == 4
    products = [o for o in added if getattr(o, "main_image_url", None) is not None]
    assert all(p.main_image_url == "/api/v1/media/file/fake.jpg" for p in products)
    assert products[0].name == "riz local"
    assert vendor.is_active is True
    db.commit.assert_called_once()


def test_import_photos_skips_non_images(monkeypatch) -> None:
    _patch_common(monkeypatch)
    monkeypatch.setattr(seller_route, "is_premium_profile", lambda _p: True)

    profile = SimpleNamespace(vendor_id="vendor-1", activity_type="shop", storefront_tier="premium")
    db = Mock()
    db.scalar.return_value = profile
    db.get.return_value = SimpleNamespace(id="vendor-1", is_active=False)
    db.add.side_effect = lambda obj: None

    not_image = StarletteUploadFile(
        file=io.BytesIO(b"hello"),
        filename="notes.txt",
        headers=Headers({"content-type": "text/plain"}),
    )
    result = asyncio.run(
        seller_route.import_product_photos(_request(), db, SimpleNamespace(id="user-1"), [not_image])
    )

    assert result["created"] == 0
    assert len(result["errors"]) == 1
