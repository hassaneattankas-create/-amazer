"""Planche-contact : toutes les images d'un dossier, en grille (QA visuelle)."""
import glob
import sys

from PIL import Image, ImageDraw

src, out, cols = sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 4
files = sorted(glob.glob(f"{src}/frame_*.png"))
tw, th = 480, 270
rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGB", (cols * tw, rows * (th + 24)), "white")
draw = ImageDraw.Draw(sheet)
for k, f in enumerate(files):
    i = int(f[-9:-4])
    im = Image.open(f).convert("RGB").resize((tw, th))
    x, y = (k % cols) * tw, (k // cols) * (th + 24)
    sheet.paste(im, (x, y + 24))
    draw.text((x + 6, y + 5), f"{i / 60:.2f} s", fill="black")
sheet.save(out)
print(out, len(files))
