import { z } from "zod";
import { LocalizedText } from "./element";
import { ElementCategory } from "./element";

/**
 * Le card didattiche sono DISACCOPPIATE dagli elementi.
 * Un elemento può non avere card; una card può essere agganciata
 * a una categoria, a un tag, a un colore o a un momento dell'esperienza.
 * Così il curatore aggiunge contenuti senza toccare la libreria grafica.
 */
export const DidacticTrigger = z.discriminatedUnion("on", [
  /** prima volta che si posa un elemento di questa categoria */
  z.object({ on: z.literal("category_first_use"), category: ElementCategory }),
  /** prima volta che si posa questo specifico elemento */
  z.object({ on: z.literal("element_first_use"), elementId: z.string() }),
  /** prima volta che si sceglie questo colore */
  z.object({ on: z.literal("color_first_use"), swatchId: z.string() }),
  /** dopo N elementi posati sulla tela */
  z.object({ on: z.literal("placement_count"), count: z.number().int().positive() }),
  /** dopo N secondi di pittura continuativa */
  z.object({ on: z.literal("paint_seconds"), seconds: z.number().int().positive() }),
  /** alla schermata finale */
  z.object({ on: z.literal("artwork_complete") }),
]);
export type DidacticTrigger = z.infer<typeof DidacticTrigger>;

export const DidacticCard = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  title: LocalizedText,
  body: LocalizedText,
  /** immagine opzionale a corredo (ritratto, dettaglio d'opera) */
  image: z.string().optional(),
  trigger: DidacticTrigger,
  /** millisecondi di permanenza a schermo prima dell'auto-dismiss */
  duration: z.number().int().min(2000).max(12000).default(5000),
  /** non mostrare più di una card ogni N ms, qualunque sia il trigger */
  ageRange: z.tuple([z.number().int(), z.number().int()]).default([5, 12]),
  /** più alto = vince se due card scattano insieme */
  priority: z.number().int().default(0),
  /** massimo numero di volte per sessione */
  maxPerSession: z.number().int().positive().default(1),
  enabled: z.boolean().default(true),
  /** da validare con il responsabile scientifico prima della messa in sala */
  reviewedBy: z.string().optional(),
});
export type DidacticCard = z.infer<typeof DidacticCard>;

export const DidacticLibrary = z.object({
  version: z.number().int().positive(),
  /** intervallo minimo globale tra due card, evita il bombardamento */
  globalCooldownMs: z.number().int().default(20000),
  cards: z.array(DidacticCard),
});
export type DidacticLibrary = z.infer<typeof DidacticLibrary>;
