import * as Tone from "tone";
import type { ElementDefinition, SoundConfig, Swatch } from "@kandinsky/schema";
import { scaleLength } from "./theory";

export interface PlacedSnapshot {
  nodeId: number;
  def: ElementDefinition;
  swatch: Swatch;
  /** posizione normalizzata sull'artboard, 0..1 */
  x: number;
  y: number;
  /** scala corrente, per durata e intensità */
  scale: number;
  rotation: number;
}

export interface TriggerEvent {
  nodeId: number;
  def: ElementDefinition;
  swatch: Swatch;
  degree: number;
  velocity: number;
  length: string;
  /** -1 arpeggio discendente, +1 ascendente */
  direction: number;
  /** -1 tutto a sinistra, +1 tutto a destra */
  pan: number;
  /** posizione lungo il ciclo, serve all'indicatore in barra */
  x: number;
  time: number;
}

/**
 * La tela è la partitura.
 *
 * Kandinsky scrive in "Punkt und Linie zu Fläche" che il piano pittorico ha
 * una direzione di lettura e una tensione temporale. Qui quella metafora
 * diventa letterale: una testina attraversa l'artboard da sinistra a destra
 * a ogni ciclo, e ogni forma suona quando viene incontrata.
 *
 *   posizione X  ->  quando suona nel ciclo
 *   posizione Y  ->  altezza della nota
 *   dimensione   ->  durata e intensità
 *   colore       ->  timbro
 *   forma        ->  articolazione
 *   rotazione    ->  direzione dell'arpeggio
 *
 * La conseguenza che conta: **spostare una forma cambia la musica**. Prima
 * trascinare un cerchio a destra non produceva nulla, ed era il gesto
 * centrale dell'esperienza.
 */
export class Sequencer {
  private repeatId: number | null = null;
  private lastPosition = 0;
  /** una forma non può ritriggerare due volte nello stesso passaggio */
  private firedThisCycle = new Set<number>();
  private cycle = 0;

  constructor(
    private config: SoundConfig,
    private getPlacements: () => PlacedSnapshot[],
    private onTrigger: (e: TriggerEvent) => void,
    private onCycle?: (cycle: number) => void,
    /** chiamato a ogni sedicesimo: serve al basso della progressione,
     *  che deve suonare anche quando la tela è vuota */
    private onTick?: (time: number) => void,
  ) {}

  start() {
    if (this.repeatId !== null) return;
    // Risoluzione a sedicesimi: sotto questa soglia il costo cresce senza
    // che l'orecchio percepisca differenza sulla griglia scelta.
    this.repeatId = Tone.getTransport().scheduleRepeat((time) => this.tick(time), "16n");
  }

  stop() {
    if (this.repeatId !== null) Tone.getTransport().clear(this.repeatId);
    this.repeatId = null;
    this.firedThisCycle.clear();
    this.lastPosition = 0;
  }

  /** Secondi mancanti alla fine del passaggio corrente. Serve alla coda finale. */
  remainingInCycle() {
    const barSec = (60 / Tone.getTransport().bpm.value) * 4;
    return (1 - this.position) * this.config.loopBars * barSec;
  }

  /** Posizione della testina, 0..1. Letta dall'interfaccia a ogni frame. */
  get position() {
    const beats = Tone.getTransport().ticks / Tone.getTransport().PPQ;
    const total = this.config.loopBars * 4;
    return (beats % total) / total;
  }

  private tick(time: number) {
    this.onTick?.(time);
    const pos = this.position;

    // Passaggio di ciclo: la testina è tornata a sinistra.
    if (pos < this.lastPosition) {
      this.firedThisCycle.clear();
      this.cycle++;
      this.onCycle?.(this.cycle);
    }

    const from = this.lastPosition;
    this.lastPosition = pos;

    for (const p of this.getPlacements()) {
      if (this.firedThisCycle.has(p.nodeId)) continue;
      // La finestra è aperta a sinistra e chiusa a destra: una forma
      // esattamente sul confine suona una volta sola.
      if (!(p.x > from && p.x <= pos)) continue;

      this.firedThisCycle.add(p.nodeId);
      this.onTrigger(this.eventFor(p, time));
    }
  }

  private eventFor(p: PlacedSnapshot, time: number): TriggerEvent {
    // Alto = acuto. Due ottave sull'altezza della tela, la stessa mappatura
    // usata dalla pittura a mano libera: una sola regola da imparare.
    const range = scaleLength(this.config.scale) * 2;
    const degree = Math.round((1 - p.y) * (range - 1));

    // Le forme grandi hanno più peso e durata: è ciò che l'occhio si aspetta.
    const size = clamp(p.scale, 0.2, 3);
    const velocity = clamp(0.28 + size * 0.22, 0.25, 0.85);

    const lengths = ["16n", "8n", "4n", "2n", "1n"];
    const base = lengths.indexOf(p.def.sound.length);
    const shift = size > 1.4 ? 1 : size < 0.5 ? -1 : 0;
    const length = lengths[clamp(base + shift, 0, lengths.length - 1)] ?? p.def.sound.length;

    return {
      nodeId: p.nodeId,
      def: p.def,
      swatch: p.swatch,
      degree,
      velocity,
      length,
      // Ruotata oltre la verticale: l'arpeggio scende invece di salire.
      direction: Math.abs(normalizeAngle(p.rotation)) > 90 ? -1 : 1,
      // Stereo dalla posizione orizzontale. Due righe di codice, e la
      // composizione acquista improvvisamente spazio.
      pan: clamp(p.x * 2 - 1, -0.85, 0.85),
      x: p.x,
      time,
    };
  }
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function normalizeAngle(deg: number) {
  const a = ((deg % 360) + 360) % 360;
  return a > 180 ? a - 360 : a;
}
