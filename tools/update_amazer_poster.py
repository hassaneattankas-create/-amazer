from pathlib import Path

import qrcode
from PIL import Image, ImageDraw, ImageFont


SOURCE = Path(
    r"C:\Users\User\.cursor\projects\c-Users-User-Documents-amazer-savegarde\assets\c__Users_User_AppData_Roaming_Cursor_User_workspaceStorage_2a0fb5ad1ec40a06213c4dff0b5d771c_images_WhatsApp_Image_2026-03-30_at_02.55.54-27bb0e90-2a4d-4ee4-b42b-ba9826e58cc7.png"
)
OUTPUT = Path(r"C:\Users\User\Documents\amazer savegarde\output\affiche-amazer-lien-actuel-playstore.png")
DESKTOP_OUTPUT = Path(r"C:\Users\User\Desktop\affiche-amazer-lien-actuel-playstore.png")
TARGET_URL = "https://amazer.store/"


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = []
    if bold:
        candidates.extend(
            [
                r"C:\Windows\Fonts\arialbd.ttf",
                r"C:\Windows\Fonts\Arialbd.ttf",
                r"C:\Windows\Fonts\segoeuib.ttf",
            ]
        )
    candidates.extend(
        [
            r"C:\Windows\Fonts\arial.ttf",
            r"C:\Windows\Fonts\Arial.ttf",
            r"C:\Windows\Fonts\segoeui.ttf",
        ]
    )
    for candidate in candidates:
        path = Path(candidate)
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def make_qr(size: int) -> Image.Image:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=12,
        border=2,
    )
    qr.add_data(TARGET_URL)
    qr.make(fit=True)
    image = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    return image.resize((size, size), Image.Resampling.NEAREST)


def rounded_panel(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int, fill: str) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def draw_play_badge(base: Image.Image, box: tuple[int, int, int, int]) -> None:
    draw = ImageDraw.Draw(base)
    x1, y1, x2, y2 = box
    rounded_panel(draw, box, radius=18, fill="#111111")
    draw.rounded_rectangle(box, radius=18, outline="#2B2B2B", width=2)

    cx = x1 + 26
    cy = (y1 + y2) // 2
    triangle = [(cx - 8, cy - 12), (cx - 8, cy + 12), (cx + 14, cy)]
    draw.polygon(triangle, fill="#34A853")
    draw.polygon([(cx - 5, cy - 9), (cx + 2, cy - 2), (cx + 9, cy - 9)], fill="#4285F4")
    draw.polygon([(cx - 5, cy + 9), (cx + 2, cy + 2), (cx + 9, cy + 9)], fill="#FBBC05")
    draw.polygon([(cx + 2, cy - 2), (cx + 14, cy), (cx + 2, cy + 2)], fill="#EA4335")

    small_font = load_font(12)
    big_font = load_font(18, bold=True)
    draw.text((x1 + 48, y1 + 10), "Telecharger sur", fill="white", font=small_font)
    draw.text((x1 + 48, y1 + 26), "Play Store", fill="white", font=big_font)


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    image = Image.open(SOURCE).convert("RGB")
    draw = ImageDraw.Draw(image)

    orange = "#FF6A00"
    white = "#FFFFFF"
    black = "#121212"

    qr_outer = (476, 638, 636, 798)
    qr_inner = (491, 653, 621, 783)

    # Rebuild only the QR area so the code remains scannable.
    draw.rounded_rectangle(qr_outer, radius=18, fill=white, outline=orange, width=3)
    qr = make_qr(qr_inner[2] - qr_inner[0])
    image.paste(qr, (qr_inner[0], qr_inner[1]))

    corner_len = 16
    corner_w = 4
    corners = [
        (qr_outer[0] + 6, qr_outer[1] + 6, 1, 1),
        (qr_outer[2] - 6, qr_outer[1] + 6, -1, 1),
        (qr_outer[0] + 6, qr_outer[3] - 6, 1, -1),
        (qr_outer[2] - 6, qr_outer[3] - 6, -1, -1),
    ]
    for x, y, sx, sy in corners:
        draw.line((x, y, x + sx * corner_len, y), fill=orange, width=corner_w)
        draw.line((x, y, x, y + sy * corner_len), fill=orange, width=corner_w)

    url_font = load_font(16, bold=True)
    url_box = (434, 808, 681, 842)
    draw.rounded_rectangle(url_box, radius=14, fill="#1C1C1C", outline="#FF7A1A", width=2)
    url_text = "amazer.store"
    bbox = draw.textbbox((0, 0), url_text, font=url_font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    draw.text(
        (url_box[0] + (url_box[2] - url_box[0] - text_w) / 2, url_box[1] + (url_box[3] - url_box[1] - text_h) / 2 - 1),
        url_text,
        fill=white,
        font=url_font,
    )

    draw_play_badge(image, (432, 853, 684, 912))

    image.save(OUTPUT, format="PNG", optimize=True)
    image.save(DESKTOP_OUTPUT, format="PNG", optimize=True)
    print(OUTPUT)
    print(DESKTOP_OUTPUT)


if __name__ == "__main__":
    main()
