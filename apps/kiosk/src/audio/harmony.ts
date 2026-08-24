import * as Tone from "tone";
import type { SoundConfig } from "@kandinsky/schema";

/**
 * Movimento armonico.
 *
 * Con `loopBars: 4` e `barsPerChord: 4`, la testina compie quattro passaggi
 * completi prima che il ciclo armonico si chiuda. Il bambino ripercorre la
 * stessa tela quattro volte e la sente cambiare: è l'unico modo per ottenere
 * variazione senza aggiungere elementi.
 *
 * L'accordo non trasporta la scala — resteremmo nella stessa promessa di
 * consonanza in ogni caso — ma sposta il centro di gravità: i gradi degli
 * elementi diventano relativi alla radice corrente.
 */
export class Harmony {
  private lastChordIndex = -1;

  constructor(private config: SoundConfig) {}

  get enabled() {
    return this.config.progression.enabled && this.config.progression.chords.length > 0;
  }

  /** Battuta assoluta dall'inizio della sessione. */
  private get bar() {
    return Math.floor(Tone.getTransport().ticks / Tone.getTransport().PPQ / 4);
  }

  get chordIndex() {
    if (!this.enabled) return 0;
    const { barsPerChord, chords } = this.config.progression;
    return Math.floor(this.bar / barsPerChord) % chords.length;
  }

  get chord() {
    return this.config.progression.chords[this.chordIndex];
  }

  /** Offset da sommare al grado di un elemento. */
  get offset() {
    return this.enabled ? this.chord.root : 0;
  }

  /** Progresso dentro l'accordo corrente, 0..1. Usato dall'interfaccia. */
  get chordProgress() {
    if (!this.enabled) return 0;
    const { barsPerChord } = this.config.progression;
    const beats = Tone.getTransport().ticks / Tone.getTransport().PPQ;
    return (beats % (barsPerChord * 4)) / (barsPerChord * 4);
  }

  /**
   * True una sola volta per cambio d'accordo. Il compositore lo usa per far
   * scendere la nota di basso: senza un fondo, il cambio armonico si sente
   * come uno scarto invece che come un movimento.
   */
  consumeChange() {
    const i = this.chordIndex;
    if (i === this.lastChordIndex) return false;
    this.lastChordIndex = i;
    return true;
  }

  reset() {
    this.lastChordIndex = -1;
  }
}
