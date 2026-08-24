import * as Tone from "tone";
import type { Timbre } from "@kandinsky/schema";

/**
 * Banco timbrico.
 *
 * La versione precedente suonava povera per un motivo preciso: ogni nota era
 * una sola onda, senza spettro. Un timbro riconoscibile nasce da tre cose che
 * mancavano tutte:
 *
 * 1. **Impilamento armonico** — ogni nota fa suonare anche i propri armonici
 *    (ottava, quinta, dodicesima) a volumi decrescenti. È ciò che distingue
 *    una nota da un segnale di prova.
 * 2. **Filtro pilotato dalla dinamica** — più forte suoni, più il timbro si
 *    apre. Su uno strumento vero il colore cambia con l'intensità; su un synth
 *    a volume fisso no, ed è il motivo per cui suona finto.
 * 3. **Scordamento leggero** — due o tre oscillatori a pochi centesimi di
 *    distanza. Il battimento che ne risulta dà corpo e movimento.
 *
 * Tutto resta costruito una volta all'avvio: creare nodi Web Audio a runtime
 * fa saturare il grafo dopo qualche ora di apertura in sala.
 */
export type Voice = Tone.PolySynth | Tone.NoiseSynth;

export interface VoiceRig {
  synth: Voice;
  filter: Tone.Filter;
  panner: Tone.Panner;
  /**
   * Armonici in semitoni rispetto alla fondamentale, con il rispettivo peso.
   * Il primo è sempre [0, 1]: la nota vera.
   */
  stack: Array<[number, number]>;
  /** apertura del filtro in Hz a intensità minima e massima */
  brightness: [number, number];
  /** scordamento in centesimi applicato ai piani superiori */
  spread: number;
}

export type VoicePool = Record<Timbre, VoiceRig>;

interface Spec {
  build: () => Voice;
  stack: Array<[number, number]>;
  brightness: [number, number];
  spread: number;
  Q?: number;
}

const SPECS: Record<Timbre, Spec> = {
  /** Corda pizzicata: fondamentale netta, ottava e dodicesima brevi sopra. */
  pluck: {
    build: () =>
      new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 16,
        oscillator: { type: "fattriangle", count: 2, spread: 12 },
        envelope: { attack: 0.003, decay: 0.9, sustain: 0.04, release: 1.4 },
      }),
    stack: [[0, 1], [12, 0.3], [19, 0.12]],
    brightness: [900, 5200],
    spread: 5,
  },

  /** Campana: armonici inarmonici, è ciò che la rende metallica. */
  bell: {
    build: () =>
      new Tone.PolySynth(Tone.FMSynth, {
        maxPolyphony: 12,
        harmonicity: 2.5,
        modulationIndex: 6,
        envelope: { attack: 0.004, decay: 2.2, sustain: 0, release: 3.2 },
        modulationEnvelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.6 },
      }),
    stack: [[0, 1], [12, 0.34], [19, 0.18], [24, 0.08]],
    brightness: [1400, 7000],
    spread: 3,
  },

  /** Tappeto: quinta e ottava sopra la fondamentale, attacco lentissimo. */
  pad: {
    build: () =>
      new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 16,
        oscillator: { type: "fatsine", count: 3, spread: 22 },
        envelope: { attack: 1.6, decay: 1.2, sustain: 0.7, release: 4.5 },
      }),
    stack: [[0, 1], [7, 0.42], [12, 0.34], [19, 0.14]],
    brightness: [500, 2600],
    spread: 9,
    Q: 0.8,
  },

  /** Ancia: spettro ricco di dispari, filtro stretto che la rende nasale. */
  reed: {
    build: () =>
      new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 12,
        oscillator: { type: "fatsquare", count: 2, spread: 16 },
        envelope: { attack: 0.09, decay: 0.5, sustain: 0.55, release: 1.3 },
      }),
    stack: [[0, 1], [12, 0.22], [19, 0.1]],
    brightness: [700, 3600],
    spread: 6,
    Q: 2.2,
  },

  /** Ottone: apre molto con la dinamica, ed è il suo tratto caratteristico. */
  brass: {
    build: () =>
      new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 10,
        oscillator: { type: "fatsawtooth", count: 3, spread: 18 },
        envelope: { attack: 0.05, decay: 0.35, sustain: 0.5, release: 0.9 },
      }),
    stack: [[0, 1], [7, 0.3], [12, 0.26]],
    brightness: [600, 5600],
    spread: 8,
    Q: 1.4,
  },

  /** Arco: attacco lento, ottava sopra sottile. */
  bow: {
    build: () =>
      new Tone.PolySynth(Tone.AMSynth, {
        maxPolyphony: 10,
        harmonicity: 1.5,
        oscillator: { type: "fatsawtooth", count: 2, spread: 10 },
        envelope: { attack: 0.75, decay: 0.6, sustain: 0.85, release: 3.4 },
      }),
    stack: [[0, 1], [12, 0.28], [19, 0.1]],
    brightness: [450, 3000],
    spread: 7,
  },

  /** Legno percosso: quasi tutto nell'attacco, armonici alti e cortissimi. */
  mallet: {
    build: () =>
      new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 16,
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.5 },
      }),
    stack: [[0, 1], [12, 0.4], [19, 0.22], [28, 0.1]],
    brightness: [1200, 6500],
    spread: 4,
  },

  /** Respiro: non ha altezza, quindi niente impilamento. */
  noise: {
    build: () =>
      new Tone.NoiseSynth({
        noise: { type: "pink" },
        envelope: { attack: 2.2, decay: 1.4, sustain: 0.3, release: 3.6 },
      }),
    stack: [[0, 1]],
    brightness: [300, 1800],
    spread: 0,
    Q: 1.6,
  },

  /** Fondo: solo fondamentale e una quinta appena accennata. */
  sub: {
    build: () =>
      new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 4,
        oscillator: { type: "fatsine", count: 2, spread: 8 },
        envelope: { attack: 0.4, decay: 0.6, sustain: 0.9, release: 2.6 },
      }),
    stack: [[0, 1], [7, 0.14], [12, 0.1]],
    brightness: [180, 700],
    spread: 4,
  },
};

export function buildVoices(destination: Tone.ToneAudioNode): VoicePool {
  const pool = {} as VoicePool;

  for (const key of Object.keys(SPECS) as Timbre[]) {
    const spec = SPECS[key];
    const panner = new Tone.Panner(0).connect(destination);
    const filter = new Tone.Filter({
      type: "lowpass",
      frequency: spec.brightness[0],
      Q: spec.Q ?? 0.7,
      rolloff: -12,
    }).connect(panner);

    const synth = spec.build();
    synth.connect(filter);

    pool[key] = {
      synth,
      filter,
      panner,
      stack: spec.stack,
      brightness: spec.brightness,
      spread: spec.spread,
    };
  }

  return pool;
}

export function isPitched(voice: Voice): voice is Tone.PolySynth {
  return !(voice instanceof Tone.NoiseSynth);
}
