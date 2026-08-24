import { z } from "zod";
import { ElementSound } from "./audio";

/**
 * Categorie del "vocabolario visivo" di Kandinsky.
 * Sono volutamente descrittive della FORMA, non del significato:
 * l'associazione forma -> significato sta nelle didascalie curatoriali,
 * mai hardcoded nel codice.
 */
export const ElementCategory = z.enum([
  "circle",
  "triangle",
  "square",
  "arc",
  "line",
  "grid",
  "organic",
  "irregular",
  "sign", // segni grafici, tratti, punti
  "fragment", // porzione ritagliata di un'opera
]);
export type ElementCategory = z.infer<typeof ElementCategory>;

/** File grafico dell'elemento. PNG con alpha premoltiplicato, @2x. */
export const ElementAsset = z.object({
  /** path relativo a packages/content/assets/ */
  file: z.string().min(1),
  /** dimensioni native in px del PNG */
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  /**
   * Punto di ancoraggio normalizzato (0..1). Default centro.
   * Serve per forme asimmetriche (archi, linee) che ruotano male sul centro del bounding box.
   */
  anchor: z
    .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
    .default({ x: 0.5, y: 0.5 }),
  /**
   * Se true la forma è monocromatica e può essere ricolorata a runtime
   * con un colore della tavolozza attiva (Konva cache + filtro RGB).
   */
  tintable: z.boolean().default(false),
});

/** Provenienza dell'elemento. Obbligatoria per la tracciabilità dei diritti. */
export const ElementProvenance = z.object({
  /** titolo dell'opera di origine, es. "Several Circles" */
  artwork: z.string().min(1),
  year: z.number().int().min(1900).max(1944).optional(),
  /** istituzione che conserva l'opera, es. "Solomon R. Guggenheim Museum" */
  holder: z.string().optional(),
  /**
   * Stato dei diritti sul FILE derivato che stiamo distribuendo.
   * Le opere di Kandinsky (m. 1944) sono in pubblico dominio in Italia,
   * ma la riproduzione fotografica può avere diritti propri.
   */
  rights: z.enum(["public-domain", "licensed", "original-artwork", "to-verify"]).default("to-verify"),
  rightsNote: z.string().optional(),
});

/** Testi didattici. Multilingua: chiave = codice locale ISO. */
export const LocalizedText = z.record(z.string().min(2).max(5), z.string());

export const ElementDidactics = z.object({
  /** una riga, max ~90 caratteri, compare nella card che appare al drop */
  short: LocalizedText,
  /** testo curatoriale esteso, opzionale, per la modalità approfondimento */
  extended: LocalizedText.optional(),
  /** id della card didattica da mostrare; se assente usa `short` */
  cardId: z.string().optional(),
});

/** Vincoli di manipolazione sulla tela. */
export const ElementBehaviour = z.object({
  /** scala iniziale al drop, relativa alla dimensione nativa */
  defaultScale: z.number().positive().default(1),
  minScale: z.number().positive().default(0.25),
  maxScale: z.number().positive().default(4),
  rotatable: z.boolean().default(true),
  /** blocca il rapporto d'aspetto: false solo per linee e barre */
  aspectLocked: z.boolean().default(true),
  duplicable: z.boolean().default(true),
});

export const ElementDefinition = z.object({
  /** id stabile, snake_case. NON riusare mai un id dismesso. */
  id: z.string().regex(/^[a-z0-9_]+$/),
  category: ElementCategory,
  /** etichetta breve per il pannello, multilingua */
  label: LocalizedText,
  asset: ElementAsset,
  provenance: ElementProvenance,
  didactics: ElementDidactics,
  behaviour: ElementBehaviour.default({}),
  /**
   * Identità musicale della forma. La forma decide il RUOLO (durata, ritmo,
   * comportamento), il colore attivo decide il TIMBRE. Vedi audio.ts.
   */
  sound: ElementSound,
  /** fascia d'età consigliata [min, max] */
  ageRange: z.tuple([z.number().int(), z.number().int()]).default([5, 12]),
  /** ordinamento nel pannello: più alto = più in alto/visibile */
  priority: z.number().int().default(0),
  /** tag liberi per filtri e set tematici ("bauhaus", "murnau", "musica") */
  tags: z.array(z.string()).default([]),
  /** false = presente nel repo ma nascosto in sala */
  enabled: z.boolean().default(true),
});
export type ElementDefinition = z.infer<typeof ElementDefinition>;

/**
 * Raggruppamento del vassoio per opera di provenienza.
 *
 * Con cinquanta elementi in una colonna, senza sezioni il bambino scorre
 * a caso e non trova due volte la stessa forma. Le opere sono anche
 * l'unico criterio che ha un senso per il curatore.
 */
export const ElementSet = z.object({
  id: z.string(),
  label: LocalizedText,
  /** opera e istituzione, mostrato in piccolo sotto il titolo della sezione */
  source: z.string().optional(),
  order: z.number().int().default(0),
});
export type ElementSet = z.infer<typeof ElementSet>;

export const ElementLibrary = z.object({
  version: z.number().int().positive(),
  updatedAt: z.string(),
  sets: z.array(ElementSet).default([]),
  elements: z.array(ElementDefinition),
});
export type ElementLibrary = z.infer<typeof ElementLibrary>;
