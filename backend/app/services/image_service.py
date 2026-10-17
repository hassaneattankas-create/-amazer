"""Images : compression des photos (telephone) pour tenir sous la limite de stockage."""

import io


def compress_image_to_limit(raw: bytes, *, max_bytes: int = 480_000) -> bytes:
    """Redimensionne (1280 px max) et compresse en JPEG jusqu'a passer sous max_bytes.

    Leve une exception si l'image est illisible (format non pris en charge).
    """
    from PIL import Image, ImageOps

    image = Image.open(io.BytesIO(raw))
    image = ImageOps.exif_transpose(image)  # photo de telephone : bonne orientation
    if image.mode != "RGB":
        background = Image.new("RGB", image.size, (255, 255, 255))
        if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
            rgba = image.convert("RGBA")
            background.paste(rgba, mask=rgba.split()[-1])
            image = background
        else:
            image = image.convert("RGB")
    if max(image.size) > 1280:
        image.thumbnail((1280, 1280))
    for quality in (85, 75, 65, 55, 45):
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=quality, optimize=True)
        if buffer.tell() <= max_bytes:
            return buffer.getvalue()
    image.thumbnail((900, 900))
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=45, optimize=True)
    return buffer.getvalue()
