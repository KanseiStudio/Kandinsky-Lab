#!/usr/bin/env python3
"""
Genera gli SVG segnaposto degli elementi di Kandinsky Lab.

Sono forme ORIGINALI in vocabolario geometrico di scuola Bauhaus, non ritagli
da riproduzioni: servono a sbloccare i test di interazione e di suono senza
aprire alcuna questione di diritti. Per la sala vanno rifatte da un designer.

Le dimensioni sono @2x e coincidono con asset.width/height in elements.json.
Gli elementi tintable sono BIANCO PURO su alpha, come richiesto da
docs/asset-spec.md: il filtro RGB di Konva moltiplica il colore, quindi
qualsiasi grigio diventerebbe una versione spenta della tinta scelta.
"""
from pathlib import Path

OUT = Path("/home/claude/kandinsky-lab/packages/content/assets/elements")
OUT.mkdir(parents=True, exist_ok=True)

W = "#FFFFFF"  # bianco puro per gli elementi ricolorabili


def svg(name: str, w: int, h: int, body: str) -> None:
    doc = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
        f'viewBox="0 0 {w} {h}">\n{body}\n</svg>\n'
    )
    (OUT / f"{name}.svg").write_text(doc)


# --- Cerchi -----------------------------------------------------------------

# Concentrico, non ricolorabile: porta i suoi colori. Riferimento visivo a
# "Several Circles", ma i colori e le proporzioni sono nostri.
svg("circle_concentric_01", 512, 512, """
  <circle cx="256" cy="256" r="248" fill="#1E3E8F"/>
  <circle cx="256" cy="256" r="186" fill="#C5202E"/>
  <circle cx="256" cy="256" r="124" fill="#EFC93B"/>
  <circle cx="256" cy="256" r="58"  fill="#F2EEDF"/>
""")

# Pieno, ricolorabile.
svg("circle_flat_01", 512, 512, f"""
  <circle cx="256" cy="256" r="250" fill="{W}"/>
""")


# --- Triangolo --------------------------------------------------------------
# Punta in alto: nel sistema sonoro è un "accent", secco e brillante.
svg("triangle_yellow_01", 512, 448, f"""
  <polygon points="256,8 504,440 8,440" fill="{W}"/>
""")


# --- Quadrato ---------------------------------------------------------------
svg("square_grid_01", 480, 480, f"""
  <rect x="6" y="6" width="468" height="468" fill="{W}"/>
""")


# --- Arco -------------------------------------------------------------------
# Ancora a 0.5/0.9: ruota attorno alla base, non al centro del riquadro,
# altrimenti il gesto a due dita risulta innaturale.
svg("arc_wide_01", 640, 320, f"""
  <path d="M 28 300 A 292 292 0 0 1 612 300"
        fill="none" stroke="{W}" stroke-width="34" stroke-linecap="round"/>
""")


# --- Linea ------------------------------------------------------------------
# Ancora a 0.0/0.5: ruota attorno all'estremo sinistro, come una lancetta.
svg("line_diagonal_01", 720, 64, f"""
  <rect x="0" y="18" width="720" height="28" rx="14" fill="{W}"/>
""")


# --- Scacchiera -------------------------------------------------------------
# Non ricolorabile: il contrasto interno è il suo contenuto.
cells = []
size = 512 // 8
for r in range(8):
    for c in range(8):
        if (r + c) % 2 == 0:
            cells.append(
                f'<rect x="{c*size}" y="{r*size}" width="{size}" height="{size}" fill="#1A1A1A"/>'
            )
svg("grid_checker_01", 512, 512, chr(10).join('  ' + c for c in cells))


# --- Forma organica ---------------------------------------------------------
# Curva chiusa asimmetrica: nel sistema sonoro è una "texture".
svg("organic_amoeba_01", 560, 480, f"""
  <path d="M 82 268
           C 46 168, 132 44, 254 32
           C 366 22, 470 88, 512 178
           C 548 256, 520 366, 428 424
           C 340 478, 208 466, 138 400
           C 96 360, 92 314, 82 268 Z"
        fill="{W}"/>
""")


# --- Zigzag -----------------------------------------------------------------
svg("sign_zigzag_01", 480, 240, f"""
  <path d="M 20 190 L 112 50 L 204 190 L 296 50 L 388 190 L 460 96"
        fill="none" stroke="{W}" stroke-width="26"
        stroke-linecap="round" stroke-linejoin="round"/>
""")


# --- Grappolo di punti ------------------------------------------------------
# "Il punto è l'inizio di tutto": dimensioni decrescenti in diagonale.
dots = [
    (108, 104, 62), (250, 78, 38), (352, 148, 46), (150, 232, 30),
    (268, 226, 54), (86, 320, 24), (206, 330, 36), (318, 300, 22),
    (330, 372, 30), (140, 384, 18),
]
svg("sign_dot_cluster_01", 400, 400, "\n".join(
    f'  <circle cx="{x}" cy="{y}" r="{r}" fill="{W}"/>' for x, y, r in dots
))


# --- Frammento --------------------------------------------------------------
# ATTENZIONE: nel seed originale questo elemento era descritto come ritaglio
# da "Composition VIII", con diritti da verificare. Qui è una composizione
# ORIGINALE che gioca con lo stesso vocabolario: per il prototipo evita del
# tutto la questione. Aggiornata anche la provenance in elements.json.
svg("fragment_composition_viii_a", 640, 640, """
  <circle cx="212" cy="196" r="132" fill="#1E3E8F"/>
  <circle cx="212" cy="196" r="66" fill="#EFC93B"/>
  <polygon points="404,92 588,404 220,404" fill="#C5202E" opacity="0.88"/>
  <path d="M 60 470 A 200 200 0 0 0 460 470" fill="none" stroke="#1A1A1A" stroke-width="14"/>
  <rect x="452" y="452" width="128" height="128" fill="#8B7BB0"/>
  <line x1="40" y1="120" x2="600" y2="120" stroke="#1A1A1A" stroke-width="8"/>
  <line x1="40" y1="152" x2="600" y2="152" stroke="#1A1A1A" stroke-width="4"/>
""")


# --- Cuneo ------------------------------------------------------------------
svg("irregular_wedge_01", 520, 400, f"""
  <polygon points="12,388 312,10 508,132 396,388" fill="{W}"/>
""")

print(f"generati {len(list(OUT.glob('*.svg')))} SVG in {OUT}")
