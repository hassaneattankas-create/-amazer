"""Icones de l'application sur fond blanc, a partir du logo officiel (public/logo-amazer-mark.png).

Genere : icones PWA (192, 512, versions « maskable »), apple-touch-icon, icones Android
(ancien format + icone adaptative : premier plan transparent, fond blanc).
Usage : python scripts/make-app-icons.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
LOGO = Image.open(ROOT / "public" / "logo-amazer-mark.png").convert("RGBA")
WHITE = (255, 255, 255, 255)


def compose(size: int, logo_ratio: float, background=WHITE, circle: bool = False) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), background)
    side = round(size * logo_ratio)
    logo = LOGO.resize((side, side), Image.LANCZOS)
    offset = (size - side) // 2
    canvas.alpha_composite(logo, (offset, offset))
    if circle:
        mask = Image.new("L", (size * 4, size * 4), 0)
        from PIL import ImageDraw

        ImageDraw.Draw(mask).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
        mask = mask.resize((size, size), Image.LANCZOS)
        rounded = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        rounded.paste(canvas, (0, 0), mask)
        return rounded
    return canvas


def save(img: Image.Image, path: Path, opaque: bool = True) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    (img.convert("RGB") if opaque else img).save(path, optimize=True)
    print("ok", path.relative_to(ROOT))


public = ROOT / "public"
# Icone « any » : logo grand, marge legere. « maskable » : logo dans la zone sure (80 % centrale).
save(compose(192, 0.80), public / "icons" / "icon-192.png")
save(compose(512, 0.80), public / "icons" / "icon-512.png")
save(compose(192, 0.62), public / "icons" / "icon-maskable-192.png")
save(compose(512, 0.62), public / "icons" / "icon-maskable-512.png")
save(compose(180, 0.78), public / "apple-touch-icon.png")
save(compose(48, 0.86), public / "favicon-48.png")

res = ROOT / "android" / "app" / "src" / "main" / "res"
# (dossier, taille icone ancienne, taille premier plan adaptatif 108 dp)
DENSITIES = [("mdpi", 48, 108), ("hdpi", 72, 162), ("xhdpi", 96, 216), ("xxhdpi", 144, 324), ("xxxhdpi", 192, 432)]
for name, legacy, foreground in DENSITIES:
    folder = res / f"mipmap-{name}"
    save(compose(legacy, 0.78), folder / "ic_launcher.png")
    save(compose(legacy, 0.70, circle=True), folder / "ic_launcher_round.png", opaque=False)
    # Zone sure de l'icone adaptative : 66 dp sur 108 -> logo a ~58 % du premier plan.
    save(compose(foreground, 0.58, background=(255, 255, 255, 0)), folder / "ic_launcher_foreground.png", opaque=False)
