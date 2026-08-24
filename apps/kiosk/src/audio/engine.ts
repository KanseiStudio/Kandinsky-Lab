import * as Tone from "tone";
import type { SoundConfig } from "@kandinsky/schema";
import type { Timbre } from "@kandinsky/schema";
import { buildVoices, isPitched, type VoicePool } from "./voices";

/**
 * Motore audio dell'installazione.
 *
 * Tre vincoli che non vengono da preferenze estetiche ma dalla sala:
 *
 * 1. Il contesto audio dei browser parte solo dopo un gesto dell'utente.
 *    Sul chiosco l'unico punto garantito è il tap su "Inizia", quindi
 *    l'unlock è agganciato lì e non altrove.
 * 2. Un limiter sul master è obbligatorio. Otto strati generativi che
 *    entrano insieme possono superare 0 dBFS e produrre distorsione,
 *    e in una sala museale un rumore sgradevole si sente da tre stanze.
 * 3. Il volume ha un tetto software non superabile dall'interfaccia.
 *    Se il personale può alzarlo, prima o poi qualcuno lo alza.
 */
export class AudioEngine {
  private master!: Tone.Gain;
  private limiter!: Tone.Limiter;
  private reverb!: Tone.Reverb;
  private dry!: Tone.Gain;
  private eq!: Tone.EQ3;
  private chorus!: Tone.Chorus;
  private glue!: Tone.Compressor;
  voices!: VoicePool;
  private started = false;
  private fadeTimer?: number;

  constructor(private config: SoundConfig, private maxGainDb: number) {}

  get isRunning() {
    return this.started;
  }

  /** Da chiamare dentro il gestore di un evento di tocco, mai altrove. */
  async unlock() {
    if (this.started) return;
    await Tone.start();

    this.limiter = new Tone.Limiter(-1).toDestination();

    /**
     * Catena master.
     *
     * Ordine e ragioni, dall'ultimo al primo:
     * - limiter, ultimo, come rete di sicurezza;
     * - compressore lento, per legare fra loro strati che entrano in momenti
     *   diversi: senza, ogni nuova forma "salta fuori" dal mix;
     * - equalizzatore, per togliere il fango sotto i 200 Hz e la durezza
     *   sopra i 6 kHz, che su diffusori piccoli da chiosco è quanto basta;
     * - chorus appena accennato, che allarga il fronte stereo senza che si
     *   senta come effetto.
     */
    this.glue = new Tone.Compressor({ threshold: -20, ratio: 2.6, attack: 0.06, release: 0.35 })
      .connect(this.limiter);
    this.eq = new Tone.EQ3({ low: -3, mid: 0, high: -2.5, lowFrequency: 220, highFrequency: 6000 })
      .connect(this.glue);
    this.chorus = new Tone.Chorus({ frequency: 0.5, delayTime: 5, depth: 0.32, wet: 0.18 })
      .connect(this.eq);
    this.chorus.start();

    this.master = new Tone.Gain(Tone.dbToGain(Math.min(this.config.masterGain, this.maxGainDb))).connect(
      this.chorus,
    );

    // Riverbero in mandata: lo "space" dei colori decide quanto ciascun
    // timbro ci finisce dentro. Un riverbero in serie li appiattirebbe tutti.
    this.reverb = new Tone.Reverb({ decay: 3.6, preDelay: 0.02, wet: 1 }).connect(this.master);
    this.dry = new Tone.Gain(1).connect(this.master);
    await this.reverb.generate();

    // Ogni timbro ha filtro e panner propri, costruiti una volta sola.
    //
    // Limite noto e accettato: le note dello stesso timbro condividono
    // filtro e panner, quindi la coda di una nota si muove se ne parte
    // un'altra con dinamica o posizione diverse. Un filtro per nota
    // richiederebbe un synth per nota, che è esattamente ciò che fa
    // saturare il grafo Web Audio dopo qualche ora di apertura.
    this.voices = buildVoices(this.dry);

    Tone.getTransport().bpm.value = this.config.bpm;
    Tone.getTransport().timeSignature = 4;
    Tone.getTransport().start("+0.1");

    this.started = true;
  }

  /**
   * Esecuzione di una nota.
   *
   * Unico punto in cui si suona: qui vengono applicati l'impilamento
   * armonico, il filtro pilotato dalla dinamica e la posizione stereo.
   * Chiamare i synth direttamente aggirerebbe tutto questo e riporterebbe
   * il suono alle onde singole di prima.
   */
  play(opts: {
    timbre: Timbre;
    note?: string;
    length: Tone.Unit.Time;
    time: number;
    velocity: number;
    pan?: number;
  }) {
    if (!this.started) return;
    const rig = this.voices[opts.timbre];
    if (!rig) return;

    if (opts.pan !== undefined) rig.panner.pan.setValueAtTime(opts.pan, opts.time);

    // Più forte suoni, più il timbro si apre: è il comportamento che
    // distingue uno strumento da un generatore a volume variabile.
    const [dark, bright] = rig.brightness;
    const cutoff = dark + (bright - dark) * Math.pow(opts.velocity, 1.4);
    rig.filter.frequency.setValueAtTime(cutoff, opts.time);

    if (!isPitched(rig.synth)) {
      (rig.synth as Tone.NoiseSynth).triggerAttackRelease(opts.length, opts.time, opts.velocity);
      return;
    }
    if (!opts.note) return;

    const base = Tone.Frequency(opts.note);
    for (const [semitones, weight] of rig.stack) {
      const detune = semitones === 0 ? 0 : (Math.random() - 0.5) * rig.spread;
      const freq = base.transpose(semitones).toFrequency() * Math.pow(2, detune / 1200);
      (rig.synth as Tone.PolySynth).triggerAttackRelease(
        freq,
        opts.length,
        // Gli armonici entrano qualche millisecondo dopo la fondamentale:
        // un attacco perfettamente simultaneo suona elettronico.
        opts.time + (semitones === 0 ? 0 : 0.004 + Math.random() * 0.006),
        opts.velocity * weight,
      );
    }
  }

  /** Accordo: ogni nota passa comunque dall'impilamento. */
  playChord(opts: {
    timbre: Timbre;
    notes: string[];
    length: Tone.Unit.Time;
    time: number;
    velocity: number;
    pan?: number;
  }) {
    opts.notes.forEach((note, i) =>
      this.play({
        ...opts,
        note,
        // Arpeggiatura minima: le note di un accordo non partono mai
        // esattamente insieme nemmeno su un pianoforte.
        time: opts.time + i * 0.012,
        velocity: opts.velocity * (1 - i * 0.08),
      }),
    );
  }

  /** Dissolvenza controllata: serve alla coda finale. */
  fadeMaster(toDb: number, seconds: number) {
    if (!this.started) return;
    this.master.gain.rampTo(Tone.dbToGain(toDb), seconds);
  }

  /** Mandata al riverbero per un singolo strato. */
  sendTo(node: Tone.ToneAudioNode, space: number) {
    const send = new Tone.Gain(space).connect(this.reverb);
    node.connect(send);
    return send;
  }

  get output() {
    return this.dry;
  }

  /** Silenzio dopo inattività: il museo non è una discoteca. */
  scheduleFadeOut(onFaded?: () => void) {
    this.cancelFadeOut();
    this.fadeTimer = window.setTimeout(() => {
      this.master.gain.rampTo(0, 4);
      onFaded?.();
    }, this.config.fadeOutAfterSec * 1000);
  }

  cancelFadeOut() {
    this.cancelFadeOutTimer();
    if (this.started) this.master.gain.rampTo(this.targetGain, 0.6);
  }

  /** Posizione corrente in battute, serve alla partitura. */
  get currentBar() {
    const [bars] = Tone.getTransport().position.toString().split(":");
    return Number(bars);
  }

  get currentBeat() {
    const parts = Tone.getTransport().position.toString().split(":");
    return Number(parts[1] ?? 0);
  }

  /**
   * Silenzio immediato e completo.
   *
   * Il solo `Transport.stop()` non basta: le note già partite continuano a
   * suonare per tutta la loro coda di rilascio, e i pad hanno tre secondi e
   * mezzo di release. Senza `releaseAll` la musica della sessione precedente
   * si sente ancora sopra la schermata di benvenuto della successiva.
   */
  silence() {
    if (!this.started) return;

    Tone.getTransport().stop();
    Tone.getTransport().cancel();
    Tone.getTransport().position = 0;

    for (const rig of Object.values(this.voices)) {
      if (rig.synth instanceof Tone.NoiseSynth) rig.synth.triggerRelease();
      else rig.synth.releaseAll();
    }

    this.cancelFadeOutTimer();
    this.master.gain.cancelScheduledValues(Tone.now());
    this.master.gain.value = 0;
  }

  /** Riprende dopo `silence()`. Chiamato quando il bambino preme "Inizia". */
  resume() {
    if (!this.started) return;
    this.master.gain.cancelScheduledValues(Tone.now());
    this.master.gain.rampTo(this.targetGain, 0.4);
    Tone.getTransport().position = 0;
    Tone.getTransport().start("+0.05");
  }

  private get targetGain() {
    return Tone.dbToGain(Math.min(this.config.masterGain, this.maxGainDb));
  }

  private cancelFadeOutTimer() {
    if (this.fadeTimer) window.clearTimeout(this.fadeTimer);
    this.fadeTimer = undefined;
  }

  dispose() {
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
  }
}
