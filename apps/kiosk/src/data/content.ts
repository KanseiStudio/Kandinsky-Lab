import {
  DidacticLibrary,
  ElementLibrary,
  KioskConfig,
  PaletteLibrary,
  SoundConfig,
  type BrushPreset,
  type ElementDefinition,
  type ElementSet,
} from "@kandinsky/schema";
import { z } from "zod";

const BrushLibrary = z.object({ version: z.number(), brushes: z.array(z.any()) });

export interface Content {
  config: KioskConfig;
  sets: ElementSet[];
  elements: ElementDefinition[];
  palettes: PaletteLibrary;
  brushes: BrushPreset[];
  didactics: DidacticLibrary;
  sound: SoundConfig;
}

/**
 * I contenuti NON sono nel bundle: stanno in /content servito staticamente.
 * Il museo può aggiungere una forma o correggere una didascalia sostituendo
 * un JSON e riavviando il chiosco, senza toccare il codice.
 *
 * La validazione Zod è volutamente rigida: meglio un errore chiaro in avvio
 * che una card vuota davanti a una classe di seconda elementare.
 */
export async function loadContent(base = "/content"): Promise<Content> {
  const [config, elements, palettes, brushes, didactics, sound] = await Promise.all([
    fetchJson(`${base}/data/kiosk.config.json`),
    fetchJson(`${base}/data/elements.json`),
    fetchJson(`${base}/data/palettes.json`),
    fetchJson(`${base}/data/brushes.json`),
    fetchJson(`${base}/data/didactics.json`),
    fetchJson(`${base}/data/sound.json`),
  ]);

  const parsedElements = ElementLibrary.parse(elements);

  /**
   * VITE_STANDALONE=1 disattiva server ed e-mail in fase di compilazione.
   *
   * Serve alle anteprime su hosting statico. Sta qui e non nel JSON perché
   * i contenuti sono gli stessi che andranno in sala: una configurazione
   * diversa non deve richiedere un file diverso da tenere allineato.
   */
  const autonomo = import.meta.env.VITE_STANDALONE === "1";
  const parsedConfig = KioskConfig.parse(config);
  if (autonomo) {
    parsedConfig.server.enabled = false;
    parsedConfig.email.enabled = false;
    console.log("[content] modalità autonoma: nessun server, nessun invio.");
  }

  return {
    config: parsedConfig,
    sets: parsedElements.sets,
    elements: parsedElements.elements
      .filter((e) => e.enabled),
    palettes: PaletteLibrary.parse(palettes),
    brushes: BrushLibrary.parse(brushes).brushes.filter((b: BrushPreset) => b.enabled),
    didactics: DidacticLibrary.parse(didactics),
    sound: SoundConfig.parse(sound),
  };
}

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Contenuto non caricato: ${url} (${res.status})`);
  return res.json();
}

/** Risolve un testo multilingua con fallback. */
export function t(text: Record<string, string> | undefined, locale: string, fallback = "en") {
  if (!text) return "";
  return text[locale] ?? text[fallback] ?? Object.values(text)[0] ?? "";
}
