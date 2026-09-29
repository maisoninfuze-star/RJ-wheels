"""Build responsive AVIF/WebP/JPEG variants of the verified RJ Instagram photos.

Source: research/instagram/full/{post_id}.jpg (see research.md §5).
Grade is deliberately light (slight contrast + desaturation) so the work stays honest.
"""
from pathlib import Path
from PIL import Image, ImageEnhance
import json

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "research/instagram/full"
OUT = ROOT / "public/assets/img/work"

PHOTOS = {
    "amg": "DF0hLpYJIYX",
    "bmw-650i": "DJ8IXVWxl1z",
    "audi": "DJsXzgPJaCP",
    "bmw-satin": "DJUTpASRa8S",
    "booth": "DGPlFznuNDa",
    "lip": "DIPaR-BpY1j",
    "black-spoke": "DFTiH1DpInY",
    "silver": "C7aFGRJJVNU",
}
WIDTHS = (480, 800, 1080)

OUT.mkdir(parents=True, exist_ok=True)
manifest = {}
for slug, post in PHOTOS.items():
    im = Image.open(SRC / f"{post}.jpg").convert("RGB")
    im = ImageEnhance.Color(im).enhance(0.88)
    im = ImageEnhance.Contrast(im).enhance(1.06)
    widths = sorted({w for w in WIDTHS if w < im.width} | {im.width})
    manifest[slug] = {"post": post, "w": im.width, "h": im.height, "widths": widths}
    for w in widths:
        v = im if w == im.width else im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        v.save(OUT / f"{slug}-{w}.avif", quality=58)
        v.save(OUT / f"{slug}-{w}.webp", quality=78, method=6)
        v.save(OUT / f"{slug}-{w}.jpg", quality=82, optimize=True, progressive=True)
    print(slug, im.size)

(ROOT / "src/images.json").write_text(json.dumps(manifest, indent=2))
