#!/usr/bin/env python3
"""
Converte gli SVG degli elementi in PNG con alpha e verifica che le dimensioni
prodotte coincidano con quelle dichiarate in elements.json.

Il controllo non è pedanteria: `asset.width/height` è ciò che il codice usa
per calcolare offset e ancoraggio. Un PNG che non corrisponde al JSON produce
forme che ruotano attorno al punto sbagliato, ed è un bug difficile da vedere
perché sembra solo "strano".

Uso:
    python3 tools/svg_to_png.py
"""
import json
from pathlib import Path

import cairosvg
from PIL import Image

ROOT = Path("/home/claude/kandinsky-lab/packages/content")
ELEMENTS = ROOT / "assets/elements"
DATA = ROOT / "data/elements.json"

declared = {
    e["id"]: (e["asset"]["width"], e["asset"]["height"], e["asset"].get("tintable", False))
    for e in json.loads(DATA.read_text())["elements"]
}

problems = []

for svg_path in sorted(ELEMENTS.glob("*.svg")):
    name = svg_path.stem
    png_path = svg_path.with_suffix(".png")

    if name not in declared:
        problems.append(f"{name}: presente come file ma assente da elements.json")
        continue

    w, h, tintable = declared[name]
    cairosvg.svg2png(url=str(svg_path), write_to=str(png_path), output_width=w, output_height=h)

    img = Image.open(png_path).convert("RGBA")
    if img.size != (w, h):
        problems.append(f"{name}: {img.size} invece di {(w, h)}")

    # Un elemento ricolorabile deve essere bianco puro: il filtro RGB di Konva
    # moltiplica, quindi un grigio diventa una tinta spenta.
    if tintable:
        pixels = [p for p in img.getdata() if p[3] > 200]
        off = [p for p in pixels if not (p[0] > 248 and p[1] > 248 and p[2] > 248)]
        ratio = len(off) / max(1, len(pixels))
        if ratio > 0.02:
            problems.append(f"{name}: tintable ma {ratio:.0%} dei pixel opachi non è bianco puro")

    alpha = img.getchannel("A")
    coverage = sum(alpha.getdata()) / (255 * w * h)
    kb = png_path.stat().st_size / 1024
    flag = "tint" if tintable else "    "
    print(f"  {name:32s} {w:4d}x{h:<4d} {flag}  copertura {coverage:5.1%}  {kb:6.1f} KB")

missing = set(declared) - {p.stem for p in ELEMENTS.glob("*.svg")}
for m in sorted(missing):
    problems.append(f"{m}: dichiarato in elements.json ma nessun SVG")

print()
if problems:
    print("PROBLEMI:")
    for p in problems:
        print(f"  - {p}")
else:
    print("Tutti gli asset coincidono con elements.json.")
