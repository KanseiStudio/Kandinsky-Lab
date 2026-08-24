import Konva from "konva";
import type { KioskConfig } from "@kandinsky/schema";
import type { CanvasStage } from "./stage";

export interface ExportResult {
  /** PNG in base64 senza prefisso data: */
  base64: string;
  width: number;
  height: number;
}

/**
 * Compone l'opera finale ad alta risoluzione.
 * A pixelRatio 3 una tela 1240x816 diventa 3720x2448: sufficiente
 * per una stampa A3 a 200 dpi, se il museo volesse anche il fisico.
 */
export async function exportArtwork(
  canvasStage: CanvasStage,
  config: KioskConfig,
  meta: {
    title: string;
    museumName: string;
    date: Date;
    logoUrl?: string;
    studioLogoUrl?: string;
  },
): Promise<ExportResult> {
  const board = canvasStage.artboardRect;
  const ratio = config.canvas.exportPixelRatio;

  // 1. Ritaglio della sola area tela dallo stage, deselezionando prima
  //    per non stampare le maniglie del transformer.
  canvasStage.elements.deselect();
  const artUrl = canvasStage.stage.toDataURL({
    x: board.x,
    y: board.y,
    width: board.width,
    height: board.height,
    pixelRatio: ratio,
    mimeType: "image/png",
  });

  const art = await loadImage(artUrl);

  // 2. Composizione con cartiglio.
  const plateHeight = Math.round(150 * ratio);
  const margin = Math.round(48 * ratio);
  const out = document.createElement("canvas");
  out.width = art.width + margin * 2;
  out.height = art.height + margin * 2 + plateHeight;

  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#EDE7DA";
  ctx.fillRect(0, 0, out.width, out.height);

  ctx.drawImage(art, margin, margin);
  ctx.strokeStyle = "#141414";
  ctx.lineWidth = 2 * ratio;
  ctx.strokeRect(margin, margin, art.width, art.height);

  const baseY = margin + art.height + Math.round(62 * ratio);
  ctx.fillStyle = "#141414";
  ctx.textBaseline = "alphabetic";

  ctx.font = `700 ${Math.round(40 * ratio)}px "Bricolage Grotesque", system-ui, sans-serif`;
  ctx.fillText(truncate(meta.title || "Senza titolo", 42), margin, baseY);

  ctx.font = `400 ${Math.round(20 * ratio)}px "Atkinson Hyperlegible", system-ui, sans-serif`;
  ctx.fillStyle = "#5A5347";
  ctx.fillText(
    `creata con Kandinsky Lab · ${meta.museumName} · ${meta.date.toLocaleDateString("it-IT")}`,
    margin,
    baseY + Math.round(34 * ratio),
  );

  // Marchio dello studio nel cartiglio, discreto: l'opera è del bambino.
  if (meta.studioLogoUrl) {
    try {
      const mark = await loadImage(meta.studioLogoUrl);
      const size = Math.round(30 * ratio);
      ctx.globalAlpha = 0.6;
      ctx.drawImage(mark, margin, baseY + Math.round(46 * ratio), size, size);
      ctx.globalAlpha = 1;
    } catch {
      // Un marchio mancante non deve impedire la consegna dell'opera.
    }
  }

  if (meta.logoUrl) {
    try {
      const logo = await loadImage(meta.logoUrl);
      const h = Math.round(70 * ratio);
      const w = (logo.width / logo.height) * h;
      ctx.drawImage(logo, out.width - margin - w, baseY - Math.round(44 * ratio), w, h);
    } catch {
      // Il logo mancante non deve impedire la consegna dell'opera.
    }
  }

  return {
    base64: out.toDataURL("image/png").split(",")[1],
    width: out.width,
    height: out.height,
  };
}

/** Anteprima leggera per la schermata finale, senza il costo del full-res. */
export function exportPreview(canvasStage: CanvasStage): string {
  const board = canvasStage.artboardRect;
  canvasStage.elements.deselect();
  return canvasStage.stage.toDataURL({ ...board, pixelRatio: 1 });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function truncate(s: string, max: number) {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
