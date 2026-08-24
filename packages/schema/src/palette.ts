import { z } from "zod";
import { LocalizedText } from "./element";
import { ColorSound } from "./audio";

export const Swatch = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  /** nome del colore mostrato al bambino, es. "blu cobalto" */
  label: LocalizedText.optional(),
  /** timbro e registro associati a questo colore */
  sound: ColorSound,
});
export type Swatch = z.infer<typeof Swatch>;

/**
 * Una tavolozza è derivata da un'opera o da un periodo.
 * In sala se ne mostra UNA per volta: 8-10 campioni sono il massimo
 * gestibile da un bambino di 5 anni senza paralisi da scelta.
 */
export const Palette = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  label: LocalizedText,
  source: z.string().optional(),
  /**
   * Fondo della tela per questa tavolozza. Composition X vive su nero:
   * i suoi colori su avorio perdono completamente la loro forza.
   */
  canvasBackground: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#F7F3E8"),
  /** vero se il fondo è scuro: l'interfaccia inverte i contrasti */
  darkCanvas: z.boolean().default(false),
  swatches: z.array(Swatch).min(4).max(12),
  enabled: z.boolean().default(true),
});
export type Palette = z.infer<typeof Palette>;

export const PaletteLibrary = z.object({
  version: z.number().int().positive(),
  defaultPaletteId: z.string(),
  palettes: z.array(Palette),
});
export type PaletteLibrary = z.infer<typeof PaletteLibrary>;

/** Strumenti pittorici. Il set è chiuso: la logica di rendering è per-tipo. */
export const BrushKind = z.enum(["brush", "wide", "fine", "pencil", "eraser"]);
export type BrushKind = z.infer<typeof BrushKind>;

export const BrushPreset = z.object({
  id: BrushKind,
  label: LocalizedText,
  /** raggio in px canvas a scala 1 */
  size: z.number().positive(),
  opacity: z.number().min(0.05).max(1).default(1),
  /** morbidezza del bordo, 0 = netto, 1 = molto sfumato */
  softness: z.number().min(0).max(1).default(0),
  /** tremolio del tratto, dà un segno meno "digitale" */
  jitter: z.number().min(0).max(1).default(0),
  icon: z.string(),
  enabled: z.boolean().default(true),
});
export type BrushPreset = z.infer<typeof BrushPreset>;
