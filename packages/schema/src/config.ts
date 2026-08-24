import { z } from "zod";

/**
 * Configurazione di sala. Sta in un file JSON esterno al bundle,
 * così l'allestitore la modifica senza rebuild.
 */
export const KioskConfig = z.object({
  kioskId: z.string().default("kiosk-01"),
  locale: z.string().default("it"),
  fallbackLocale: z.string().default("en"),
  /** tavolo touch orizzontale full HD */
  canvas: z.object({
    width: z.number().int().default(1920),
    height: z.number().int().default(1080),
    /** area della tela dentro il layout, in px */
    artboard: z.object({
      x: z.number().int().default(360),
      y: z.number().int().default(140),
      width: z.number().int().default(1200),
      height: z.number().int().default(800),
    }),
    /** moltiplicatore di risoluzione per l'export finale (1200x800 -> 3600x2400) */
    exportPixelRatio: z.number().default(3),
  }),
  /** doppia tavolozza speculare sui due lati lunghi del tavolo */
  mirrorToolbars: z.boolean().default(false),
  /** massimo numero di elementi contemporanei sulla tela, per le performance */
  maxPlacements: z.number().int().default(60),
  paletteId: z.string().default("bauhaus_primary"),
  idle: z.object({
    /** secondi di inattività prima dell'avviso */
    warningAfterSec: z.number().int().default(90),
    /** secondi dopo l'avviso prima del reset alla welcome */
    resetAfterSec: z.number().int().default(20),
  }),
  email: z.object({
    enabled: z.boolean().default(true),
    /** testo del consenso mostrato a schermo, versionato */
    consentVersion: z.string().default("1.0"),
  }),
  server: z.object({
    /**
     * false = modalità autonoma: nessuna chiamata di rete, l'opera resta
     * sul dispositivo. Serve per le anteprime su hosting statico, dove un
     * server che accetti le opere semplicemente non esiste.
     */
    enabled: z.boolean().default(true),
    /** Stringa vuota = stessa origine da cui è servita l'esperienza. */
    baseUrl: z.string().default(""),
    /** se il server non risponde l'opera resta in coda locale */
    timeoutMs: z.number().int().default(8000),
  }),
  audio: z.object({
    enabled: z.boolean().default(true),
    /**
     * L'audio del browser parte solo dopo un gesto dell'utente.
     * Sul chiosco il gesto è il tap su "Inizia": è l'unico punto
     * garantito del flusso in cui possiamo sbloccare il contesto audio.
     */
    unlockOn: z.enum(["start_button", "first_touch"]).default("start_button"),
    /** tetto di volume non superabile dall'interfaccia, in dB */
    maxGain: z.number().default(-6),
  }).default({}),
  debug: z.boolean().default(false),
});
export type KioskConfig = z.infer<typeof KioskConfig>;
