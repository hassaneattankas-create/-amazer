#!/usr/bin/env python3
"""
Génère des titres et descriptions prêts pour publication AMAZER à partir d'un dossier de photos.

Sans clé API : crée des miniatures (pour revue manuelle) + un CSV modèle (fichier, chemins).

Avec OpenAI (vision) : remplit titre, description courte, description détaillée, mots-clés en français.

Usage:
  python tools/generate_amazer_photo_listings.py "C:\\Users\\User\\Documents\\ama"

Variables d'environnement:
  OPENAI_API_KEY   — obligatoire pour le remplissage automatique (modèle gpt-4o-mini).
  AMA_THUMB_MAX    — taille max du plus grand côté des miniatures (défaut 640).
"""

from __future__ import annotations

import argparse
import base64
import csv
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image


def iter_images(folder: Path) -> list[Path]:
    exts = {".jpg", ".jpeg", ".png", ".webp", ".JPG", ".JPEG", ".PNG", ".WEBP"}
    files: list[Path] = []
    for p in sorted(folder.iterdir()):
        if p.is_file() and p.suffix in exts:
            files.append(p)
    return files


def make_thumbnail(src: Path, dst: Path, max_side: int) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as im:
        im = im.convert("RGB")
        w, h = im.size
        scale = min(max_side / max(w, h), 1.0)
        if scale < 1.0:
            nw, nh = int(w * scale), int(h * scale)
            im = im.resize((nw, nh), Image.Resampling.LANCZOS)
        im.save(dst, "JPEG", quality=82, optimize=True)


def image_to_data_url(path: Path) -> str:
    raw = path.read_bytes()
    b64 = base64.standard_b64encode(raw).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"


def openai_vision_batch(
    api_key: str,
    items: list[tuple[str, str]],
    model: str = "gpt-4o-mini",
) -> list[dict]:
    """
    items: list of (filename, data_url)
    Returns list of dicts with keys: fichier, titre, description_courte, description_longue, mots_cles
    """
    sys_prompt = (
        "Tu rédiges des fiches produit pour la marketplace AMAZER (Niger). "
        "Langue: français. Ton: clair, vendeur, sans mentir sur ce que tu ne vois pas. "
        "Si le produit n'est pas identifiable, reste générique (ex. article divers) et indique "
        "les incertitudes dans la description longue. "
        "Réponds UNIQUEMENT avec un JSON valide: tableau d'objets, un par image dans l'ordre, "
        "champs: fichier, titre (max 80 car.), description_courte (1 phrase), "
        "description_longue (2 à 4 phrases, avantages, usage, entretien si visible), "
        "mots_cles (5 à 12 termes séparés par des virgules)."
    )
    user_content: list[dict] = [
        {"type": "text", "text": "Voici des photos. Fichiers dans l'ordre: " + ", ".join(f for f, _ in items)}
    ]
    for fname, url in items:
        user_content.append({"type": "text", "text": f"Image fichier: {fname}"})
        user_content.append({"type": "image_url", "image_url": {"url": url}})

    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": user_content},
        ],
        "max_tokens": 4096,
        "temperature": 0.4,
    }
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenAI HTTP {e.code}: {err}") from e

    text = data["choices"][0]["message"]["content"].strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        if "```" in text:
            text = text.rsplit("```", 1)[0]
    parsed = json.loads(text)
    if not isinstance(parsed, list):
        raise ValueError("Réponse OpenAI: JSON attendu = liste")
    return parsed


def main() -> int:
    ap = argparse.ArgumentParser(description="Fiches AMAZER depuis photos")
    ap.add_argument("source", type=Path, help="Dossier contenant les images")
    ap.add_argument("--batch", type=int, default=4, help="Images par appel API (défaut 4)")
    ap.add_argument("--thumbs-only", action="store_true", help="Ne génère que les miniatures + CSV vide")
    args = ap.parse_args()

    src: Path = args.source.expanduser().resolve()
    if not src.is_dir():
        print(f"Dossier introuvable: {src}", file=sys.stderr)
        return 1

    max_side = int(os.environ.get("AMA_THUMB_MAX", "640"))
    thumbs_dir = src / "_amazer_thumbs"
    images = iter_images(src)
    if not images:
        print(f"Aucune image dans {src}", file=sys.stderr)
        return 1

    print(f"{len(images)} image(s). Miniatures -> {thumbs_dir}")
    for p in images:
        dst = thumbs_dir / (p.stem + ".jpg")
        make_thumbnail(p, dst, max_side)

    out_csv = src / "AMAZER_listings.csv"
    out_md = src / "AMAZER_listings.md"

    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    rows: list[dict] = []

    if args.thumbs_only or not api_key:
        if not api_key and not args.thumbs_only:
            print("OPENAI_API_KEY absent: écriture du modèle CSV uniquement (miniatures OK).")
        for p in images:
            rows.append(
                {
                    "fichier": p.name,
                    "miniature": str(thumbs_dir / (p.stem + ".jpg")),
                    "titre": "",
                    "description_courte": "",
                    "description_longue": "",
                    "mots_cles": "",
                }
            )
    else:
        batch_size = max(1, min(args.batch, 8))
        i = 0
        while i < len(images):
            chunk = images[i : i + batch_size]
            i += batch_size
            thumb_paths = [thumbs_dir / (p.stem + ".jpg") for p in chunk]
            items = [(p.name, image_to_data_url(tp)) for p, tp in zip(chunk, thumb_paths)]
            print(f"API OpenAI: lot {i // batch_size} ({len(items)} image(s))...")
            parsed = openai_vision_batch(api_key, items)
            by_file = {str(x.get("fichier", "")): x for x in parsed}
            for p in chunk:
                r = by_file.get(p.name, {})
                rows.append(
                    {
                        "fichier": p.name,
                        "miniature": str(thumbs_dir / (p.stem + ".jpg")),
                        "titre": r.get("titre", ""),
                        "description_courte": r.get("description_courte", ""),
                        "description_longue": r.get("description_longue", ""),
                        "mots_cles": r.get("mots_cles", ""),
                    }
                )
            time.sleep(0.6)

    fieldnames = ["fichier", "miniature", "titre", "description_courte", "description_longue", "mots_cles"]
    with out_csv.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)

    lines: list[str] = [
        "# Fiches produit AMAZER (généré)",
        "",
        f"Nombre de photos: {len(images)}.",
        "",
    ]
    for r in rows:
        lines.extend(
            [
                f"## {r['fichier']}",
                "",
                f"**Titre:** {r['titre'] or '—'}",
                "",
                f"**Court:** {r['description_courte'] or '—'}",
                "",
                f"**Détail:** {r['description_longue'] or '—'}",
                "",
                f"**Mots-clés:** {r['mots_cles'] or '—'}",
                "",
                "---",
                "",
            ]
        )
    out_md.write_text("\n".join(lines), encoding="utf-8")

    print(f"CSV: {out_csv}")
    print(f"Markdown: {out_md}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
