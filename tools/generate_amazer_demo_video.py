from __future__ import annotations

from pathlib import Path
import tempfile
import textwrap

from PIL import Image, ImageDraw, ImageFont
from moviepy import AudioFileClip, ImageClip, concatenate_videoclips


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "docs"
OUT_FILE = OUT_DIR / "amazer-presentation.mp4"

WIDTH = 1280
HEIGHT = 720
BG = (15, 23, 42)
ACCENT = (255, 77, 0)
TEXT = (241, 245, 249)
SUBTEXT = (203, 213, 225)


SLIDES = [
    (
        "Bienvenue sur AMAZER",
        "AMAZER permet de comparer les prix, commander facilement et suivre les commandes en temps reel.",
    ),
    (
        "Navigation principale",
        "Boutiques, Restaurant, Premium, Promotions, Notifications et Panier sont accessibles depuis la barre du haut.",
    ),
    (
        "Page Boutique",
        "Le client compare les offres, ajuste les quantites et ajoute rapidement les produits au panier.",
    ),
    (
        "Page Restaurant",
        "Selection du restaurant, ajout des plats et envoi de commande en quelques clics.",
    ),
    (
        "Panier et commande",
        "Choix du mode de paiement, type de livraison, puis validation. Le statut passe en payment_pending puis commande.",
    ),
    (
        "Recu securise",
        "Chaque commande genere un lien recu securise pour preuve de paiement et suivi client-vendeur.",
    ),
    (
        "Notifications",
        "Les alertes informent des nouvelles commandes, des mises a jour de statut et des actions importantes.",
    ),
    (
        "Espace vendeur",
        "Le vendeur gere son profil, ses produits, ses plats, son stock et le statut de chaque commande.",
    ),
    (
        "Conclusion",
        "AMAZER centralise achat, vente et suivi dans une experience simple, fiable et rapide.",
    ),
]


def _load_font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    candidates = [
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
    ]
    for font_path in candidates:
        path = Path(font_path)
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def _create_slide_image(title: str, body: str, index: int, total: int, output: Path) -> None:
    img = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(img)

    title_font = _load_font(62, bold=True)
    body_font = _load_font(38, bold=False)
    footer_font = _load_font(26, bold=False)

    draw.rectangle([(0, 0), (WIDTH, 16)], fill=ACCENT)
    draw.rectangle([(64, 120), (WIDTH - 64, HEIGHT - 90)], outline=(51, 65, 85), width=3)

    draw.text((88, 155), title, fill=TEXT, font=title_font)

    wrapped = textwrap.fill(body, width=52)
    draw.multiline_text((88, 270), wrapped, fill=SUBTEXT, font=body_font, spacing=12)

    footer = f"AMAZER - Guide utilisateur ({index}/{total})"
    draw.text((88, HEIGHT - 65), footer, fill=(148, 163, 184), font=footer_font)

    img.save(output)


def _build_voice(text: str, output: Path) -> bool:
    try:
        import pyttsx3

        engine = pyttsx3.init()
        engine.setProperty("rate", 150)
        engine.save_to_file(text, str(output))
        engine.runAndWait()
        return output.exists() and output.stat().st_size > 0
    except Exception:
        return False


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    clips = []

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp = Path(tmp_dir)

        for idx, (title, body) in enumerate(SLIDES, start=1):
            image_file = tmp / f"slide_{idx:02d}.png"
            _create_slide_image(title, body, idx, len(SLIDES), image_file)

            narration = f"{title}. {body}"
            voice_file = tmp / f"slide_{idx:02d}.wav"
            has_voice = _build_voice(narration, voice_file)

            if has_voice:
                audio = AudioFileClip(str(voice_file))
                clip = ImageClip(str(image_file)).with_duration(audio.duration + 0.8).with_audio(audio)
            else:
                clip = ImageClip(str(image_file)).with_duration(6.0)
            clips.append(clip)

        final = concatenate_videoclips(clips, method="compose")
        final.write_videofile(
            str(OUT_FILE),
            fps=24,
            codec="libx264",
            audio_codec="aac",
            bitrate="3500k",
            preset="medium",
        )

        for clip in clips:
            clip.close()
        final.close()

    print(f"Video generated: {OUT_FILE}")


if __name__ == "__main__":
    main()
