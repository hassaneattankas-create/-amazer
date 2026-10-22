"""Seules de vraies images sont acceptees, quel que soit le type annonce."""

from app.routes.media import _looks_like_image


def test_real_image_signatures_are_accepted() -> None:
    assert _looks_like_image(b"\xff\xd8\xff\xe0rest")
    assert _looks_like_image(b"\x89PNG\r\n\x1a\nrest")
    assert _looks_like_image(b"RIFF\x00\x00\x00\x00WEBPVP8 ")
    assert _looks_like_image(b"GIF89a....")


def test_html_disguised_as_image_is_refused() -> None:
    assert not _looks_like_image(b"<html><script>alert(1)</script>")
    assert not _looks_like_image(b"%PDF-1.7")
