#!/usr/bin/env python3
"""
Integra i 50 PNG estratti dalle opere e le relative schede curatoriali.

Tre operazioni, in quest'ordine:

1. **Ritaglio sul contenuto.** I file arrivano tutti 1024x1024 con la forma
   centrata su trasparenza. Senza ritaglio ogni elemento avrebbe lo stesso
   riquadro, e il punto di ancoraggio finirebbe nel vuoto: una forma piccola
   in un angolo ruoterebbe attorno a un centro che non le appartiene.

2. **Riduzione e quantizzazione.** 50 file da mezzo megabyte fanno 25 MB da
   caricare all'avvio: su un mini-PC con grafica integrata sono secondi di
   attesa e memoria video sprecata. Il tetto di docs/asset-spec.md resta
   640 px sul lato lungo e 120 KB per file.

3. **Generazione dei dati.** elements.json e didactics.json nascono dalle
   dimensioni misurate sui file reali, non da valori scritti a mano: è la
   sola garanzia che asset e JSON restino coerenti.
"""
import json
import re
import unicodedata
from pathlib import Path

from PIL import Image

SRC = Path("/home/claude/incoming/elementi")
OUT = Path("/home/claude/kandinsky-lab/packages/content/assets/elements")
DATA = Path("/home/claude/kandinsky-lab/packages/content/data")
ROWS = json.loads(Path("/home/claude/incoming/rows.json").read_text())

MAX_SIDE = 640          # @2x, quindi 320 px a schermo
TARGET_KB = 120

# --- Opere -------------------------------------------------------------------
# I titoli seguono il documento: dove l'identificazione non è certificata,
# resta esplicito. Non inventiamo attribuzioni che il curatore dovrà smentire.
OPERE = {
    "01_Intersecting_Lines_1923": {
        "tag": "intersecting_lines",
        "artwork": "Intersecting Lines (Sich kreuzende Linien)",
        "year": 1923,
        "holder": None,
        "rightsNote": "Titolo identificato tramite riferimento [8]. Verificare i diritti sulla riproduzione fotografica prima della messa in sala.",
    },
    "02_Composizione_verticale": {
        "tag": "opera_verticale",
        "artwork": "Opera verticale — titolo non certificato",
        "year": None,
        "holder": None,
        "rightsNote": "Il nome era una denominazione tecnica di lavoro, non un titolo storico. Identificazione dell'opera da completare con il curatore.",
    },
    "03_Yellow_Red_Blue": {
        "tag": "gelb_rot_blau",
        "artwork": "Gelb-Rot-Blau (Jaune-rouge-bleu)",
        "year": 1925,
        "holder": "Centre Pompidou",
        "rightsNote": "Opera documentata dal Centre Pompidou [5]. Verificare i diritti sulla riproduzione fotografica.",
    },
    "04_Small_Worlds": {
        "tag": "small_worlds",
        "artwork": "Immagine fornita — attribuzione a Kleine Welten non certificata",
        "year": None,
        "holder": None,
        "rightsNote": "La fonte MoMA [6] è contesto sul portfolio, non prova dell'identità di questa immagine. Attribuzione da verificare.",
    },
    "05_Tension_Douce_85": {
        "tag": "delicate_tension",
        "artwork": "Delicate Tension. No. 85",
        "year": 1923,
        "holder": "Museo Nacional Thyssen-Bornemisza",
        "rightsNote": "Opera documentata dal Thyssen-Bornemisza [7]. Verificare i diritti sulla riproduzione fotografica.",
    },
}

# --- Forma -> ruolo musicale -------------------------------------------------
# La forma decide il comportamento nel tempo; il colore, scelto dal bambino,
# decide il timbro. Le parole chiave vengono dal nome tecnico del frammento.
RUOLI = [
    (r"scacchier|griglia|reticolo",       {"role": "pulse",    "length": "16n", "every": 1, "gain": -8}),
    (r"strisc|linee|linea|nodi",          {"role": "pulse",    "length": "8n",  "every": 1, "gain": -6}),
    (r"catena|colonna|sequenz",           {"role": "sequence", "length": "16n", "every": 2, "gain": -5}),
    (r"arch|curva|orbita|semicerchio|loop|onde|vortice|razzo",
                                          {"role": "sweep",    "length": "8n",  "every": 4, "gain": -5}),
    (r"cluster|aggregato|pannello|rettangolo",
                                          {"role": "chord",    "length": "1n",  "every": 4, "gain": -6}),
    (r"triangolo|rombo|zigzag|simbolo|polo",
                                          {"role": "accent",   "length": "16n", "every": 1, "gain": -3}),
    (r"blob|ovale|forma organica",        {"role": "texture",  "length": "2m",  "every": 4, "gain": -8}),
    (r"anello|cerchio|pianeta",           {"role": "pad",      "length": "1n",  "every": 2, "gain": -4}),
    (r"quadrato",                         {"role": "drone",    "length": "2m",  "every": 4, "gain": -5}),
]
DEFAULT_RUOLO = {"role": "pad", "length": "1n", "every": 2, "gain": -5}

CATEGORIE = [
    (r"scacchier|griglia|reticolo", "grid"),
    (r"triangolo|rombo",            "triangle"),
    (r"quadrato|rettangolo|pannello", "square"),
    (r"arch|curva|semicerchio|orbita|loop", "arc"),
    (r"strisc|linee|linea",         "line"),
    (r"zigzag|simbolo|nodi|polo",   "sign"),
    (r"blob|onde|ovale",            "organic"),
    (r"anello|cerchio|pianeta|catena|colonna", "circle"),
    (r"cluster|aggregato|vortice|razzo", "fragment"),
]


def slug(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def match(table, name: str, default=None):
    for pattern, value in table:
        if re.search(pattern, name):
            return value
    return default


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.png"):
        old.unlink()
    for old in OUT.glob("*.svg"):
        old.unlink()

    # Indice delle schede per nome file
    schede = {}
    for cell0, descrizione, fonti in ROWS:
        righe = [r.strip() for r in cell0.split("\n") if r.strip()]
        filename = re.sub(r"^\d+\.\s*", "", righe[0])
        etichetta = righe[1] if len(righe) > 1 else filename
        schede[filename] = {"label": etichetta, "body": descrizione, "sources": fonti}

    elementi, cards, mancanti = [], [], []
    priorita = 1000

    for cartella in sorted(SRC.iterdir()):
        if not cartella.is_dir():
            continue
        opera = OPERE[cartella.name]

        for png in sorted(cartella.glob("*.png")):
            scheda = schede.get(png.name)
            if not scheda:
                mancanti.append(png.name)
                continue

            img = Image.open(png).convert("RGBA")

            # 1. Ritaglio sull'alfa reale.
            bbox = img.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
            if not bbox:
                mancanti.append(f"{png.name} (interamente trasparente)")
                continue
            img = img.crop(bbox)

            # 2. Riduzione entro il tetto del lato lungo.
            if max(img.size) > MAX_SIDE:
                ratio = MAX_SIDE / max(img.size)
                img = img.resize(
                    (max(1, round(img.width * ratio)), max(1, round(img.height * ratio))),
                    Image.LANCZOS,
                )

            eid = f"{opera['tag']}__{slug(re.sub(r'^\\d+_\\d+_', '', png.stem))}"
            dest = OUT / f"{eid}.png"
            img.save(dest, "PNG", optimize=True)

            # Quantizzazione solo se serve: preserva la resa dove è già leggera.
            if dest.stat().st_size / 1024 > TARGET_KB:
                img.convert("RGBA").quantize(colors=192, method=Image.FASTOCTREE).save(
                    dest, "PNG", optimize=True
                )

            w, h = img.size
            ruolo = match(RUOLI, png.stem.lower(), DEFAULT_RUOLO)
            categoria = match(CATEGORIE, png.stem.lower(), "fragment")

            # Le forme molto allungate non devono poter essere deformate;
            # quelle a specchio verticale non hanno un verso di rotazione utile.
            allungata = max(w, h) / min(w, h) > 2.6

            elementi.append({
                "id": eid,
                "category": categoria,
                "label": {"it": scheda["label"], "en": scheda["label"]},
                "asset": {
                    "file": f"elements/{eid}.png",
                    "width": w,
                    "height": h,
                    "anchor": {"x": 0.5, "y": 0.5},
                    "tintable": False,
                },
                "provenance": {
                    "artwork": opera["artwork"],
                    **({"year": opera["year"]} if opera["year"] else {}),
                    **({"holder": opera["holder"]} if opera["holder"] else {}),
                    "rights": "to-verify",
                    "rightsNote": opera["rightsNote"],
                },
                "didactics": {
                    "short": {"it": scheda["label"], "en": scheda["label"]},
                    "extended": {"it": scheda["body"]},
                    "cardId": f"card_{eid}",
                },
                "behaviour": {
                    "defaultScale": round(min(1.0, 260 / max(w, h)), 3),
                    "minScale": 0.15,
                    "maxScale": 2.5,
                    "rotatable": True,
                    "aspectLocked": not allungata,
                    "duplicable": True,
                },
                "sound": {**ruolo, "loops": True},
                "ageRange": [5, 12],
                "priority": priorita,
                "tags": [opera["tag"], scheda["sources"].split("—")[0].strip().lower()],
                "enabled": True,
            })
            priorita -= 1

            cards.append({
                "id": f"card_{eid}",
                "title": {"it": scheda["label"], "en": scheda["label"]},
                "body": {"it": scheda["body"]},
                "trigger": {"on": "element_first_use", "elementId": eid},
                "duration": 7000,
                "ageRange": [5, 12],
                "priority": 5,
                "maxPerSession": 1,
                "enabled": True,
            })

    # --- Scrittura -----------------------------------------------------------
    json.dump(
        {"version": 3, "updatedAt": "2026-08-24", "elements": elementi},
        open(DATA / "elements.json", "w"), ensure_ascii=False, indent=2,
    )

    esistenti = json.loads((DATA / "didactics.json").read_text())
    generali = [c for c in esistenti["cards"] if not c["id"].startswith("card_")
                or c["id"] in {"card_bauhaus", "card_complete", "card_music"}]
    json.dump(
        {
            "version": 3,
            # Le schede compaiono a ogni forma nuova: il ritardo minimo scende,
            # ma resta, o due drop ravvicinati ne farebbero sparire una.
            "globalCooldownMs": 4000,
            "cards": cards + generali,
        },
        open(DATA / "didactics.json", "w"), ensure_ascii=False, indent=2,
    )

    peso = sum(f.stat().st_size for f in OUT.glob("*.png")) / 1024 / 1024
    print(f"elementi:  {len(elementi)}")
    print(f"schede:    {len(cards)} specifiche + {len(generali)} generali")
    print(f"peso:      {peso:.1f} MB totali, {peso*1024/len(elementi):.0f} KB medi")
    if mancanti:
        print("SENZA SCHEDA:", mancanti)

    from collections import Counter
    print("categorie:", dict(Counter(e["category"] for e in elementi)))
    print("ruoli:    ", dict(Counter(e["sound"]["role"] for e in elementi)))


if __name__ == "__main__":
    main()
