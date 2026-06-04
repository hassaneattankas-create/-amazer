from pathlib import Path

import qrcode
from PIL import Image, ImageDraw, ImageFilter, ImageFont


SOURCE_POSTER = Path(
    r"C:\Users\User\.cursor\projects\c-Users-User-Documents-amazer-savegarde\assets\c__Users_User_AppData_Roaming_Cursor_User_workspaceStorage_2a0fb5ad1ec40a06213c4dff0b5d771c_images_WhatsApp_Image_2026-03-30_at_02.55.54-27bb0e90-2a4d-4ee4-b42b-ba9826e58cc7.png"
)
OUTPUT = Path(r"C:\Users\User\Documents\amazer savegarde\output\affiche-amazer-premium-2026.png")
DESKTOP_OUTPUT = Path(r"C:\Users\User\Desktop\affiche-amazer-premium-2026.png")
TARGET_URL = "https://amazer.store/"
DISPLAY_URL = "amazer.store"

W, H = 1080, 1350
ORANGE = "#FF6A00"
DEEP_ORANGE = "#FF7F1A"
CREAM = "#FFF7EF"
INK = "#101114"
MUTED = "#555962"
CARD = "#17191F"
WHITE = "#FFFFFF"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates: list[str] = []
    if bold:
        candidates += [
            r"C:\Windows\Fonts\arialbd.ttf",
            r"C:\Windows\Fonts\segoeuib.ttf",
            r"C:\Windows\Fonts\calibrib.ttf",
        ]
    candidates += [
        r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\calibri.ttf",
    ]
    for candidate in candidates:
        path = Path(candidate)
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def make_background() -> Image.Image:
    base = Image.new("RGB", (W, H), CREAM)
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.ellipse((620, -40, 1200, 560), fill=(255, 124, 0, 210))
    draw.ellipse((700, 820, 1220, 1430), fill=(255, 124, 0, 185))
    draw.ellipse((560, 120, 1180, 980), fill=(255, 180, 120, 65))
    overlay = overlay.filter(ImageFilter.GaussianBlur(58))
    return Image.alpha_composite(base.convert("RGBA"), overlay).convert("RGB")


def rounded(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int, fill: str, outline: str | None = None, width: int = 1) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def make_qr(size: int) -> Image.Image:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=12,
        border=2,
    )
    qr.add_data(TARGET_URL)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    return img.resize((size, size), Image.Resampling.NEAREST)


def add_logo(base: Image.Image, source: Image.Image) -> None:
    crop = source.crop((18, 18, 355, 126)).convert("RGBA")
    crop = crop.resize((430, 138), Image.Resampling.LANCZOS)
    base.alpha_composite(crop, (58, 48))


def add_phone_visual(base: Image.Image, source: Image.Image) -> None:
    phone_crop = source.crop((380, 10, 725, 690)).convert("RGBA")
    phone_crop = phone_crop.resize((395, 780), Image.Resampling.LANCZOS)

    shadow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.rounded_rectangle((630, 130, 980, 905), radius=48, fill=(0, 0, 0, 95))
    shadow = shadow.filter(ImageFilter.GaussianBlur(26))
    base.alpha_composite(shadow)

    frame = Image.new("RGBA", (360, 808), (0, 0, 0, 0))
    fdraw = ImageDraw.Draw(frame)
    fdraw.rounded_rectangle((0, 0, 360, 808), radius=54, fill=(255, 255, 255, 238), outline=(255, 255, 255, 255), width=3)
    inner = Image.new("RGBA", (330, 778), (255, 255, 255, 0))
    inner.alpha_composite(phone_crop.resize((330, 778), Image.Resampling.LANCZOS))
    frame.alpha_composite(inner, (15, 15))
    base.alpha_composite(frame, (620, 120))


def write_multiline(draw: ImageDraw.ImageDraw, text: str, xy: tuple[int, int], line_gap: int, font_obj: ImageFont.ImageFont, fill: str) -> int:
    x, y = xy
    for line in text.split("\n"):
        draw.text((x, y), line, font=font_obj, fill=fill)
        bbox = draw.textbbox((x, y), line, font=font_obj)
        y = bbox[3] + line_gap
    return y


def draw_feature(draw: ImageDraw.ImageDraw, y: int, title: str, body: str) -> int:
    draw.ellipse((72, y + 6, 98, y + 32), fill=ORANGE)
    draw.text((120, y), title, font=font(30, bold=True), fill=INK)
    body_font = font(22)
    body_y = y + 42
    draw.multiline_text((120, body_y), body, font=body_font, fill=MUTED, spacing=6)
    bbox = draw.multiline_textbbox((120, body_y), body, font=body_font, spacing=6)
    draw.line((70, bbox[3] + 26, 500, bbox[3] + 26), fill="#E8D8C8", width=2)
    return bbox[3] + 42


def add_play_badge(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int]) -> None:
    rounded(draw, box, 22, "#111315", outline="#2D2F35", width=2)
    x1, y1, x2, y2 = box
    cx = x1 + 38
    cy = (y1 + y2) // 2
    draw.polygon([(cx - 12, cy - 18), (cx - 12, cy + 18), (cx + 20, cy)], fill="#34A853")
    draw.polygon([(cx - 8, cy - 14), (cx + 2, cy - 3), (cx + 12, cy - 14)], fill="#4285F4")
    draw.polygon([(cx - 8, cy + 14), (cx + 2, cy + 3), (cx + 12, cy + 14)], fill="#FBBC05")
    draw.polygon([(cx + 2, cy - 3), (cx + 20, cy), (cx + 2, cy + 3)], fill="#EA4335")
    draw.text((x1 + 68, y1 + 11), "Disponible sur", font=font(16), fill="#CFD2D8")
    draw.text((x1 + 68, y1 + 31), "Google Play", font=font(24, bold=True), fill=WHITE)


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    source = Image.open(SOURCE_POSTER).convert("RGBA")
    base = make_background().convert("RGBA")
    draw = ImageDraw.Draw(base)

    add_logo(base, source)

    draw.text((64, 195), "LA MARKETPLACE", font=font(56, bold=True), fill=INK)
    draw.text((64, 268), "PREMIUM", font=font(68, bold=True), fill=ORANGE)
    draw.text((64, 348), "QUI FAIT GRANDIR", font=font(49, bold=True), fill=INK)
    draw.text((64, 412), "VOTRE BUSINESS", font=font(49, bold=True), fill=INK)

    subtitle = (
        "AMAZER aide vendeurs, boutiques et restaurateurs\n"
        "a publier, gerer leurs commandes et fideliser\n"
        "leurs clients depuis une seule plateforme."
    )
    write_multiline(draw, subtitle, (70, 505), 10, font(24), MUTED)

    rounded(draw, (64, 625, 340, 688), 30, ORANGE)
    draw.text((94, 641), "TOUT POUR GRANDIR", font=font(26, bold=True), fill=WHITE)

    y = 734
    y = draw_feature(draw, y, "VITRINE DIGITALE PRO", "Mettez vos produits et services en avant\navec une presentation claire et moderne.")
    y = draw_feature(draw, y, "COMMANDES EN TEMPS REEL", "Suivez chaque commande, de la reception\njusqu'a la livraison ou la remise.")
    y = draw_feature(draw, y, "PAIEMENTS ET CONFIANCE", "Une experience simple, serieuse et rassurante\npour vous et vos clients.")

    add_phone_visual(base, source)

    # Highlight card around the QR zone
    shadow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.rounded_rectangle((605, 885, 1032, 1225), radius=38, fill=(0, 0, 0, 90))
    shadow = shadow.filter(ImageFilter.GaussianBlur(22))
    base.alpha_composite(shadow)
    rounded(draw, (598, 900, 1018, 1220), 42, CARD, outline="#2A2D33", width=2)

    draw.text((630, 935), "SCANNEZ POUR", font=font(32, bold=True), fill=ORANGE)
    draw.text((630, 975), "VISITER AMAZER", font=font(32, bold=True), fill=ORANGE)
    draw.text((630, 1022), "Le lien actuel est integre directement", font=font(19), fill="#D6DAE0")
    draw.text((630, 1050), "dans ce QR statique.", font=font(19), fill="#D6DAE0")

    qr_box = (628, 1086, 824, 1282)
    rounded(draw, qr_box, 26, WHITE, outline=DEEP_ORANGE, width=4)
    qr = make_qr(172)
    base.paste(qr, (640, 1098))

    url_box = (850, 1098, 990, 1150)
    rounded(draw, url_box, 18, "#22252B", outline=DEEP_ORANGE, width=2)
    draw.text((885, 1113), "Lien direct", font=font(18, bold=True), fill="#FFD3B3")
    draw.multiline_text((850, 1170), DISPLAY_URL, font=font(16, bold=True), fill=WHITE, spacing=4)

    add_play_badge(draw, (838, 1178, 1004, 1242))

    footer_box = (0, 1274, W, H)
    draw.rectangle(footer_box, fill="#0F1014")
    draw.text((64, 1298), "Rapide", font=font(24, bold=True), fill=WHITE)
    draw.text((225, 1298), "Professionnel", font=font(24, bold=True), fill=WHITE)
    draw.text((472, 1298), "Scannable", font=font(24, bold=True), fill=WHITE)
    draw.text((655, 1298), "Play Store", font=font(24, bold=True), fill=WHITE)
    draw.text((858, 1298), "Made for Niger", font=font(24, bold=True), fill=WHITE)

    final = base.convert("RGB")
    final.save(OUTPUT, format="PNG", optimize=True)
    final.save(DESKTOP_OUTPUT, format="PNG", optimize=True)
    print(OUTPUT)
    print(DESKTOP_OUTPUT)


if __name__ == "__main__":
    main()
