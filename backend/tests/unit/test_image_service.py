"""Photos de telephone : compressees sous la limite de stockage au lieu d'etre refusees."""

import io

import pytest
from PIL import Image

from app.services.image_service import compress_image_to_limit


def _photo(size=(3000, 4000), mode="RGB") -> bytes:
    noise = Image.effect_noise(size, 90).convert(mode)  # photo « detaillee » donc lourde
    buffer = io.BytesIO()
    noise.save(buffer, format="PNG" if mode == "RGBA" else "JPEG", quality=95)
    return buffer.getvalue()


def test_heavy_phone_photo_is_compressed_under_the_limit() -> None:
    raw = _photo()
    assert len(raw) > 1_000_000
    small = compress_image_to_limit(raw)
    assert len(small) <= 480_000
    image = Image.open(io.BytesIO(small))
    assert image.format == "JPEG" and max(image.size) <= 1280


def test_transparent_png_gets_a_white_background() -> None:
    small = compress_image_to_limit(_photo((1600, 1600), "RGBA"))
    assert Image.open(io.BytesIO(small)).mode == "RGB"


def test_unreadable_file_is_rejected() -> None:
    with pytest.raises(Exception):
        compress_image_to_limit(b"ceci n'est pas une image")
