import { z } from "zod";

/**
 * Sistema sonoro di Kandinsky Lab.
 *
 * Principio guida, dal deck: "Non esiste una nota sbagliata."
 * Questo NON è un vincolo estetico, è un vincolo architetturale che decide
 * tutto il resto: ogni suono generato viene quantizzato a una scala unica e
 * a una griglia ritmica unica. Il bambino non può produrre una dissonanza
 * perché le note fuori scala non esistono nel sistema.
 *
 * Le associazioni colore -> timbro sono CONTENUTO, non codice: stanno in
 * sound.json e vanno validate dal curatore. Il riferimento è la sinestesia
 * descritta da Kandinsky stesso (il giallo che squilla come una tromba,
 * il blu profondo come un violoncello), ma resta un'interpretazione, non
 * una verità da incidere nel software.
 */

/** Scale senza semitoni conflittuali: qualunque combinazione resta consonante. */
export const MusicalScale = z.enum([
  "major_pentatonic",
  "minor_pentatonic",
  "lydian",
  "dorian",
  "whole_tone", // per le palette più astratte, sospese
]);
export type MusicalScale = z.infer<typeof MusicalScale>;

/** Famiglie timbriche disponibili nel motore. Set chiuso: ogni voce è codice. */
export const Timbre = z.enum([
  "pluck", // corda pizzicata, attacco netto
  "bell", // FM metallico, lunga coda
  "pad", // sostenuto, morbido
  "reed", // ance, corpo medio
  "brass", // squillante
  "bow", // archi, attacco lento
  "mallet", // marimba, legno
  "noise", // texture, respiro
  "sub", // basso profondo senza attacco
]);
export type Timbre = z.infer<typeof Timbre>;

/**
 * Identità sonora di un colore.
 * Il colore decide COME suona: timbro e registro.
 */
export const ColorSound = z.object({
  timbre: Timbre,
  /** ottava di riferimento. 2 = grave, 6 = acuto */
  octave: z.number().int().min(1).max(7).default(4),
  /** volume relativo, dB. Serve a bilanciare timbri squillanti e sordi */
  gain: z.number().min(-24).max(6).default(0),
  /** quantità di riverbero, 0..1 */
  space: z.number().min(0).max(1).default(0.3),
  /** descrizione per il curatore e per l'eventuale didascalia */
  note: z.string().optional(),
});
export type ColorSound = z.infer<typeof ColorSound>;

/**
 * Ruolo musicale di una forma.
 * La forma decide COSA suona: durata, ritmo, comportamento nel tempo.
 *
 * Colore x forma = timbro x ruolo. Dodici forme e otto colori danno
 * novantasei combinazioni sonore da una manciata di dati.
 */
export const MusicalRole = z.enum([
  "drone", // nota tenuta, fa da fondo
  "pad", // accordo lungo, si muove piano
  "accent", // colpo singolo, breve
  "pulse", // ostinato ritmico regolare
  "sequence", // arpeggio o frase di più note
  "sweep", // glissando, sale o scende
  "texture", // rumore filtrato, atmosfera
  "chord", // triade della scala
]);
export type MusicalRole = z.infer<typeof MusicalRole>;

export const ElementSound = z.object({
  role: MusicalRole,
  /**
   * Grado della scala, 0-based. 0 = tonica.
   * Lasciato assente, il compositore lo assegna in modo che il nuovo
   * elemento non raddoppi un grado già presente sulla tela.
   */
  degree: z.number().int().min(0).max(6).optional(),
  /** lunghezza in figure musicali */
  length: z.enum(["16n", "8n", "4n", "2n", "1n", "2m", "4m"]).default("2n"),
  /**
   * Ogni quante battute rientra. 0 = suona una volta sola al posizionamento.
   * 1 = ogni battuta, 2 = ogni due battute.
   */
  every: z.number().min(0).max(8).default(2),
  /** peso nel mix, dB relativi al colore */
  gain: z.number().min(-24).max(6).default(0),
  /** se true l'elemento entra nel loop permanente; se false è un one-shot */
  loops: z.boolean().default(true),
});
export type ElementSound = z.infer<typeof ElementSound>;

/** Sonificazione del gesto pittorico, indipendente dagli elementi. */
export const PaintSound = z.object({
  enabled: z.boolean().default(true),
  /** un tratto sotto questa durata (ms) diventa una nota singola */
  shortStrokeMs: z.number().int().default(320),
  /** velocità del dito -> intensità. px/s che corrispondono a velocity 1.0 */
  velocityReference: z.number().default(1400),
  /** note massime al secondo per pointer: impedisce la mitragliata */
  maxNotesPerSecond: z.number().default(6),
  /** i tratti lunghi tengono una nota che scivola sui gradi della scala */
  legatoGlide: z.boolean().default(true),
});

/**
 * Progressione armonica lenta sotto la composizione.
 *
 * Una pentatonica statica non risolve mai: è il motivo per cui quasi tutto
 * il generativo suona uguale a sé stesso dopo trenta secondi. Con una
 * progressione, la stessa forma nello stesso punto della tela suona diversa
 * alla quarta battuta e alla dodicesima. Nasce l'attesa, che è la materia
 * prima della musica.
 *
 * `root` è un grado della scala, non un accordo cifrato: restiamo dentro
 * la stessa promessa di consonanza, spostando il centro di gravità.
 */
export const Progression = z.object({
  enabled: z.boolean().default(true),
  /** battute per accordo. 4 accordi x 4 battute = ciclo armonico di 16 */
  barsPerChord: z.number().int().min(1).max(8).default(4),
  chords: z
    .array(
      z.object({
        root: z.number().int().min(0).max(6),
        /** etichetta per il curatore, non mostrata al pubblico */
        label: z.string().optional(),
      }),
    )
    .min(2)
    .max(8),
  /** nota di basso a ogni cambio: dà il fondo senza aggiungere voci in evidenza */
  bass: z.object({
    enabled: z.boolean().default(true),
    timbre: Timbre.default("sub"),
    octave: z.number().int().min(1).max(4).default(2),
    gain: z.number().default(-10),
  }),
});
export type Progression = z.infer<typeof Progression>;

/**
 * Coda finale. Alla pressione di "Ho finito" il ciclo non deve semplicemente
 * proseguire: quello non è una firma sonora, è un rubinetto lasciato aperto.
 */
export const Finale = z.object({
  /** secondi di dissolvenza degli strati ritmici prima della risoluzione */
  retreatSec: z.number().default(3),
  /** durata dell'accordo di chiusura */
  resolveSec: z.number().default(6),
  /** coda di riverbero dopo l'ultimo accordo */
  tailSec: z.number().default(5),
});

/**
 * Configurazione musicale globale della sala.
 * Un solo tono e un solo tempo per tutta l'esperienza: è ciò che permette
 * a strati generati in momenti diversi di restare insieme.
 */
export const SoundConfig = z.object({
  version: z.number().int().positive(),
  enabled: z.boolean().default(true),
  key: z.string().default("D"),
  scale: MusicalScale.default("major_pentatonic"),
  bpm: z.number().min(40).max(160).default(72),
  /** lunghezza del ciclo in battute: tutti gli strati si riallineano qui */
  loopBars: z.number().int().min(2).max(16).default(4),
  /**
   * Voci simultanee massime. Oltre questa soglia lo strato più vecchio
   * viene abbassato e poi ritirato: senza questo, a venti forme sulla tela
   * il risultato è fango sonoro e i bambini smettono di ascoltare.
   */
  maxVoices: z.number().int().min(3).max(16).default(7),
  /** volume master in dB. In sala si tara col fonometro, non a orecchio. */
  masterGain: z.number().min(-40).max(0).default(-9),
  /** dopo N secondi senza tocchi la musica sfuma. Il museo non è una discoteca. */
  fadeOutAfterSec: z.number().int().default(45),
  paint: PaintSound.default({}),
  progression: Progression,
  finale: Finale.default({}),
});
export type SoundConfig = z.infer<typeof SoundConfig>;

/**
 * Partitura serializzabile dell'opera.
 *
 * È il pezzo che rende il progetto sostenibile: la musica non viene
 * registrata come audio, viene descritta. Un file da 2 KB invece di
 * 4 MB di WAV, ricostruibile identico su qualunque browser, allegabile
 * a un link di riascolto senza toccare lo storage del museo.
 */
export const Score = z.object({
  key: z.string(),
  scale: MusicalScale,
  bpm: z.number(),
  loopBars: z.number(),
  /** ordine di ingresso degli strati: è la storia della composizione */
  layers: z.array(
    z.object({
      elementId: z.string(),
      swatchId: z.string(),
      role: MusicalRole,
      timbre: Timbre,
      degree: z.number().int(),
      octave: z.number().int(),
      length: z.string(),
      every: z.number(),
      /** battuta di ingresso rispetto all'inizio della sessione */
      enterBar: z.number().int(),
    }),
  ),
  /** note prodotte dipingendo, per la riproduzione fedele del riascolto */
  strokes: z
    .array(
      z.object({
        bar: z.number(),
        beat: z.number(),
        degree: z.number().int(),
        octave: z.number().int(),
        timbre: Timbre,
        velocity: z.number().min(0).max(1),
        length: z.string(),
      }),
    )
    .default([]),
});
export type Score = z.infer<typeof Score>;
