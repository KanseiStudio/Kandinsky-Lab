import { z } from "zod";
import { Score } from "./audio";

/**
 * Sessione anonima. Nessun dato personale se non l'e-mail,
 * inserita solo alla fine e trattata come dato effimero (vedi retention).
 */
export const Placement = z.object({
  elementId: z.string(),
  x: z.number(),
  y: z.number(),
  scaleX: z.number(),
  scaleY: z.number(),
  rotation: z.number(),
  tint: z.string().nullable().default(null),
  z: z.number().int(),
});
export type Placement = z.infer<typeof Placement>;

/** Telemetria aggregata e anonima, utile al museo per la relazione finale. */
export const SessionStats = z.object({
  durationMs: z.number().int(),
  strokeCount: z.number().int(),
  placementCount: z.number().int(),
  undoCount: z.number().int(),
  clearCount: z.number().int(),
  paletteId: z.string(),
  soundLayers: z.number().int().default(0),
  didacticCardsShown: z.array(z.string()),
  completed: z.boolean(),
  emailRequested: z.boolean(),
});

export const ArtworkSubmission = z.object({
  sessionId: z.string().uuid(),
  /** titolo scelto dal bambino, filtrato lato server */
  title: z.string().max(60),
  /** PNG in base64 senza prefisso data: */
  imageBase64: z.string(),
  /** ricostruzione vettoriale della composizione, per ristampe e analisi */
  placements: z.array(Placement).default([]),
  /**
   * Partitura della firma sonora. Viaggia come JSON, non come audio:
   * qualche KB invece di megabyte, e ricostruibile identica nel browser
   * dalla pagina di riascolto linkata nell'e-mail.
   */
  score: Score.optional(),
  stats: SessionStats.partial().optional(),
  /** e-mail dell'adulto accompagnatore. Assente = opera non spedita. */
  email: z.string().email().optional(),
  /** consenso esplicito raccolto a schermo */
  consent: z
    .object({
      acceptedAt: z.string(),
      version: z.string(),
    })
    .optional(),
  /** id postazione, per capire quale tavolo genera più opere */
  kioskId: z.string().default("kiosk-01"),
  createdAt: z.string(),
});
export type ArtworkSubmission = z.infer<typeof ArtworkSubmission>;

export const DeliveryStatus = z.enum(["queued", "sending", "sent", "failed", "purged"]);
export type DeliveryStatus = z.infer<typeof DeliveryStatus>;
