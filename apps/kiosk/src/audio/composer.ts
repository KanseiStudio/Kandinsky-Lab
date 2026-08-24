import * as Tone from "tone";
import type { ElementDefinition, Score, SoundConfig, Swatch } from "@kandinsky/schema";
import { AudioEngine } from "./engine";
import type { TriggerEvent } from "./sequencer";
import { Harmony } from "./harmony";
import { chordFor, noteFor, pickDegree } from "./theory";

interface Layer {
  id: number;
  elementId: string;
  swatchId: string;
  degree: number;
  octave: number;
  timbre: ElementDefinition["sound"] extends never ? never : string;
  loopId: number | null;
  gain: Tone.Gain;
  enterBar: number;
  addedAt: number;
}

/**
 * Il compositore.
 *
 * Traduce la regola del deck — "ogni nuovo colore o forma aggiunge un livello
 * alla composizione" — in un arrangiamento che resta ascoltabile anche dopo
 * quaranta forme.
 *
 * La scelta strutturale è che gli strati NON si accumulano all'infinito.
 * Superato `maxVoices` lo strato più vecchio viene abbassato e ritirato:
 * la musica continua a cambiare mentre il bambino compone, invece di
 * diventare un muro. Il quadro cresce, la musica si trasforma.
 */
export class Composer {
  private layers: Layer[] = [];
  private nextId = 1;
  private strokeEvents: Score["strokes"] = [];

  readonly harmony: Harmony;
  private bassGain: Tone.Gain | null = null;

  constructor(
    private engine: AudioEngine,
    private config: SoundConfig,
  ) {
    this.harmony = new Harmony(config);
  }

  /**
   * Battito armonico. Chiamato a ogni sedicesimo dal sequencer, suona solo
   * quando l'accordo cambia.
   *
   * La nota di basso non è decorativa: senza un fondo che scende, il cambio
   * d'accordo si percepisce come uno scarto invece che come un movimento.
   */
  tickHarmony(time: number) {
    if (!this.engine.isRunning) return;
    const bass = this.config.progression.bass;
    if (!bass.enabled || !this.harmony.enabled) return;
    if (!this.harmony.consumeChange()) return;

    if (!this.bassGain) {
      this.bassGain = new Tone.Gain(Tone.dbToGain(bass.gain)).connect(this.engine.output);
      this.engine.sendTo(this.bassGain, 0.4);
    }

    this.engine.play({
      timbre: bass.timbre,
      note: noteFor(this.config.key, this.config.scale, this.harmony.offset, bass.octave),
      length: `${this.config.progression.barsPerChord}m`,
      time,
      velocity: 0.5,
      pan: 0,
    });
  }

  get layerCount() {
    return this.layers.length;
  }

  /**
   * Esecuzione pilotata dal sequencer: la testina ha incontrato una forma.
   *
   * Qui non si decide più QUANDO suonare — quello lo dice la posizione della
   * forma sulla tela — ma solo COME, in base a ruolo, timbro e articolazione.
   */
  trigger(e: TriggerEvent) {
    if (!this.engine.isRunning) return;

    const color = e.swatch.sound;
    const octave = color.octave;
    const offset = this.harmony.offset;
    const note = (d: number) => noteFor(this.config.key, this.config.scale, d + offset, octave);

    // Umanizzazione: la griglia matematicamente perfetta è ciò che fa suonare
    // "digitale" qualunque cosa. Quindici millisecondi bastano.
    const t = e.time + (Math.random() - 0.5) * 0.03;
    const common = { timbre: color.timbre, pan: e.pan } as const;

    switch (e.def.sound.role) {
      case "chord":
        this.engine.playChord({
          ...common,
          notes: chordFor(this.config.key, this.config.scale, e.degree + offset, octave),
          length: e.length,
          time: t,
          velocity: e.velocity,
        });
        break;

      case "sequence": {
        const step = Tone.Time("8n").toSeconds();
        for (let i = 0; i < 4; i++) {
          this.engine.play({
            ...common,
            note: note(e.degree + i * e.direction),
            length: e.length,
            time: t + i * step,
            velocity: e.velocity * (1 - i * 0.12),
          });
        }
        break;
      }

      case "sweep": {
        const step = Tone.Time("32n").toSeconds();
        for (let i = 0; i < 6; i++) {
          this.engine.play({
            ...common,
            note: note(e.degree + i * e.direction),
            length: "16n",
            time: t + i * step,
            velocity: e.velocity * 0.55,
          });
        }
        break;
      }

      case "pulse": {
        // Ostinato: due colpi ravvicinati, il secondo più debole.
        const step = Tone.Time("8n").toSeconds();
        this.engine.play({ ...common, note: note(e.degree), length: e.length, time: t, velocity: e.velocity * 0.8 });
        this.engine.play({ ...common, note: note(e.degree), length: e.length, time: t + step, velocity: e.velocity * 0.5 });
        break;
      }

      case "drone":
      case "pad":
        // Le voci tenute suonano la quinta insieme alla fondamentale:
        // è ciò che le fa percepire come tappeto e non come nota singola.
        this.engine.playChord({
          ...common,
          notes: [note(e.degree), note(e.degree + 2)],
          length: e.length,
          time: t,
          velocity: e.velocity * 0.85,
        });
        break;

      default:
        this.engine.play({ ...common, note: note(e.degree), length: e.length, time: t, velocity: e.velocity });
    }
  }

  /** Un elemento posato entra nell'arrangiamento. */
  addElement(def: ElementDefinition, swatch: Swatch) {
    if (!this.engine.isRunning) return;

    const sound = def.sound;
    const color = swatch.sound;
    const degree = sound.degree ?? pickDegree(this.config.scale, this.layers.map((l) => l.degree));

    const gain = new Tone.Gain(Tone.dbToGain(color.gain + sound.gain)).connect(this.engine.output);
    this.engine.sendTo(gain, color.space);

    const layer: Layer = {
      id: this.nextId++,
      elementId: def.id,
      swatchId: swatch.id,
      degree,
      octave: color.octave,
      timbre: color.timbre,
      loopId: null,
      gain,
      enterBar: this.engine.currentBar,
      addedAt: Date.now(),
    };

    /**
     * Riscontro immediato al drop.
     *
     * Il ripasso periodico lo gestisce il Sequencer leggendo la posizione X;
     * qui serve solo la risposta istantanea al gesto. Uno senza l'altro non
     * funziona: solo l'immediato è un giocattolo, solo la testina è un'attesa
     * incomprensibile.
     */
    const play = (time: number) => {
      const velocity = 0.55;
      const note = (d: number) => noteFor(this.config.key, this.config.scale, d, color.octave);
      const common = { timbre: color.timbre, pan: 0 } as const;

      switch (sound.role) {
        case "chord":
          this.engine.playChord({
            ...common,
            notes: chordFor(this.config.key, this.config.scale, degree, color.octave),
            length: sound.length,
            time,
            velocity,
          });
          break;

        case "sequence": {
          const step = Tone.Time("8n").toSeconds();
          for (let i = 0; i < 4; i++) {
            this.engine.play({
              ...common,
              note: note(degree + i),
              length: sound.length,
              time: time + i * step,
              velocity: velocity * (1 - i * 0.12),
            });
          }
          break;
        }

        case "sweep": {
          const step = Tone.Time("16n").toSeconds();
          for (let i = 0; i < 6; i++) {
            this.engine.play({
              ...common,
              note: note(degree + i),
              length: "16n",
              time: time + i * step,
              velocity: velocity * 0.6,
            });
          }
          break;
        }

        case "drone":
        case "pad":
          this.engine.playChord({
            ...common,
            notes: [note(degree), note(degree + 2)],
            length: sound.length,
            time,
            velocity: velocity * 0.85,
          });
          break;

        default:
          this.engine.play({
            ...common,
            note: note(degree),
            length: sound.length,
            time,
            velocity: sound.role === "pulse" ? velocity * 0.8 : velocity,
          });
      }
    };

    // Suono immediato al momento del drop.
    //
    // Il ripasso periodico lo gestisce il Sequencer leggendo la posizione X:
    // qui serve solo il riscontro istantaneo al gesto. Uno senza l'altro non
    // funziona — solo l'immediato è un giocattolo, solo la testina è un'attesa
    // incomprensibile.
    play(Tone.now() + 0.02);

    this.layers.push(layer);
    this.enforceVoiceBudget();
    this.engine.cancelFadeOut();
  }

  /** Il colore attivo cambia: il prossimo elemento avrà un altro timbro. */
  previewColor(swatch: Swatch) {
    if (!this.engine.isRunning) return;
    this.engine.play({
      timbre: swatch.sound.timbre,
      note: noteFor(this.config.key, this.config.scale, this.harmony.offset, swatch.sound.octave),
      length: "8n",
      time: Tone.now(),
      velocity: 0.35,
      pan: 0,
    });
  }

  /** Nota generata dipingendo. Registrata anche in partitura. */
  playStrokeNote(swatch: Swatch, degree: number, velocity: number, length: string) {
    if (!this.engine.isRunning) return;
    const octave = swatch.sound.octave;
    this.engine.play({
      timbre: swatch.sound.timbre,
      note: noteFor(this.config.key, this.config.scale, degree + this.harmony.offset, octave),
      length,
      time: Tone.now(),
      velocity,
    });

    this.strokeEvents.push({
      bar: this.engine.currentBar,
      beat: this.engine.currentBeat,
      degree,
      octave,
      timbre: swatch.sound.timbre,
      velocity,
      length,
    });

    this.engine.cancelFadeOut();
  }

  /**
   * Coda finale.
   *
   * Alla pressione di "Ho finito" il ciclo non deve semplicemente proseguire:
   * quello non è una firma sonora, è un rubinetto lasciato aperto. La chiusura
   * ha tre tempi — ultimo passaggio completo della testina, ritiro degli strati,
   * risoluzione sulla tonica con coda di riverbero.
   *
   * Restituisce la durata totale in secondi, così l'interfaccia sa quanto
   * tenere l'opera a schermo prima di passare oltre.
   */
  finale(remainingInCycleSec: number): number {
    const { retreatSec, resolveSec, tailSec } = this.config.finale;
    if (!this.engine.isRunning) return 0;

    // Il passaggio in corso si completa: tagliarlo a metà si sente come errore.
    const lastPass = Math.max(0.4, remainingInCycleSec);
    const now = Tone.now();

    // 1. Gli strati ritmici si ritirano mentre la testina finisce la corsa.
    setTimeout(() => this.engine.fadeMaster(this.config.masterGain - 4, retreatSec), lastPass * 1000);

    // 2. Risoluzione sulla tonica, fuori dalla progressione: è il punto in cui
    //    l'armonia torna a casa, e va sentito come tale.
    const resolveAt = now + lastPass + retreatSec;
    this.engine.playChord({
      timbre: "pad",
      notes: chordFor(this.config.key, this.config.scale, 0, 4),
      length: resolveSec,
      time: resolveAt,
      velocity: 0.45,
      pan: 0,
    });
    this.engine.play({
      timbre: "bow",
      note: noteFor(this.config.key, this.config.scale, 0, 3),
      length: resolveSec,
      time: resolveAt + 0.05,
      velocity: 0.4,
      pan: 0,
    });
    this.engine.play({
      timbre: "sub",
      note: noteFor(this.config.key, this.config.scale, 0, 2),
      length: resolveSec,
      time: resolveAt,
      velocity: 0.5,
      pan: 0,
    });

    // 3. Coda: il riverbero si spegne da solo.
    setTimeout(() => this.engine.fadeMaster(-60, tailSec), (lastPass + retreatSec + resolveSec) * 1000);

    return lastPass + retreatSec + resolveSec + tailSec;
  }

  /**
   * Ritira lo strato più vecchio quando si supera il budget di voci.
   * Il ritiro è graduale, tre secondi: un taglio netto si sente come errore.
   */
  private enforceVoiceBudget() {
    while (this.layers.length > this.config.maxVoices) {
      const oldest = this.layers.shift()!;
      oldest.gain.gain.rampTo(0, 3);
      setTimeout(() => this.disposeLayer(oldest), 3400);
    }
  }

  removeElement(elementId: string) {
    const index = this.layers.findIndex((l) => l.elementId === elementId);
    if (index < 0) return;
    const [layer] = this.layers.splice(index, 1);
    layer.gain.gain.rampTo(0, 1.2);
    setTimeout(() => this.disposeLayer(layer), 1500);
  }

  private disposeLayer(layer: Layer) {
    (layer as any).loop?.dispose();
    layer.gain.dispose();
  }

  clear() {
    this.layers.forEach((l) => this.disposeLayer(l));
    this.layers = [];
    this.strokeEvents = [];
    this.harmony.reset();
    this.bassGain?.dispose();
    this.bassGain = null;
    // Il silenzio lo decide il chiamante: al riavvio va fermato tutto,
    // dopo "Ricomincia" dentro la sessione invece si continua a suonare.
  }

  /**
   * La partitura è ciò che viene salvato e spedito: 2 KB di JSON al posto
   * di un WAV da qualche megabyte, e ricostruibile identica in un browser.
   */
  serialize(elements: Map<string, ElementDefinition>): Score {
    return {
      key: this.config.key,
      scale: this.config.scale,
      bpm: this.config.bpm,
      loopBars: this.config.loopBars,
      layers: this.layers.map((l) => {
        const def = elements.get(l.elementId)!;
        return {
          elementId: l.elementId,
          swatchId: l.swatchId,
          role: def.sound.role,
          timbre: l.timbre as any,
          degree: l.degree,
          octave: l.octave,
          length: def.sound.length,
          every: def.sound.every,
          enterBar: l.enterBar,
        };
      }),
      strokes: this.strokeEvents.slice(-200),
    };
  }
}
