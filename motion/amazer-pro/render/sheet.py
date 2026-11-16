"""Planche de contrôle : python render/sheet.py qa/pub1 out.png [colonnes] [taille]"""
import sys, glob, os
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 3
size = int(sys.argv[4]) if len(sys.argv) > 4 else 540
files = sorted(glob.glob(os.path.join(src, '*.png')))
rows = (len(files) + cols - 1) // cols
im = Image.new('RGB', (cols * size, rows * size), 'black')
d = ImageDraw.Draw(im)
for k, f in enumerate(files):
    a = Image.open(f).convert('RGB').resize((size, size), Image.LANCZOS)
    x, y = (k % cols) * size, (k // cols) * size
    im.paste(a, (x, y))
    d.rectangle([x, y, x + 110, y + 26], fill='black')
    d.text((x + 6, y + 6), os.path.basename(f)[:-4], fill='white')
im.save(out)
print(out, len(files))
