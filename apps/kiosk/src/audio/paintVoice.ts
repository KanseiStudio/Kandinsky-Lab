import type { Swatch } from "@kandinsky/schema";
import type { SoundConfig } from "@kandinsky/schema";
import type { Composer } from "./composer";
import { scaleLength } from "./theory";

/**
 * Sonificazione del gesto pittorico.
 *
 * Dal deck: "Un tratto breve può diventare una nota; un tratto lungo una frase.
 * La velocità del gesto può modificare ritmo e intensità."
 *
 * Il problema pratico non è generare note, è NON generarne troppe. Un dito
 * che si muove su un pannello a 120 Hz produce centinaia di eventi al secondo.
 * Senza il throttle qui sotto il risultato è una mitragliata, non musica,
 * e con quattro bambini contemporanei il motore audio si pianta.
 *
 * La regola scelta: l'altezza della nota dipende dalla POSIZIONE VERTICALE
 * del dito sulla tela. È la mappatura che i bambini scoprono da soli in
 * pochi secondi — in alto acuto, in basso grave — ed è anche la sola che
 * regga senza istruzioni.
 */
export class PaintVoice {
  private lastNoteAt = new Map<number, number>();
  private strokeStart = new Map<number, { t: number; x: number; y: number }>();

  constructor(
    private composer: Composer,
    private config: SoundConfig,
    private bounds: { x: number; y: number; width: number; height: number },
  ) {}

  begin(pointerId: number, x: number, y: number) {
    this.strokeStart.set(pointerId, { t: performance.now(), x, y });
  }

  move(pointerId: number, x: number, y: number, swatch: Swatch) {
    if (!this.config.paint.enabled) return;

    const now = performance.now();
    const last = this.lastNoteAt.get(pointerId) ?? 0;
    const minGap = 1000 / this.config.paint.maxNotesPerSecond;
    if (now - last < minGap) return;

    const start = this.strokeStart.get(pointerId);
    if (!start) return;

    // Velocità istantanea approssimata sull'intervallo fra due note.
    const dt = Math.max(16, now - last) / 1000;
    const speed = Math.hypot(x - start.x, y - start.y) / dt;
    const velocity = clamp(0.2 + speed / this.config.paint.velocityReference, 0.2, 0.9);

    this.lastNoteAt.set(pointerId, now);
    this.composer.playStrokeNote(swatch, this.degreeFor(y), velocity, "8n");
  }

  end(pointerId: number, swatch: Swatch, y: number) {
    const start = this.strokeStart.get(pointerId);
    this.strokeStart.delete(pointerId);
    this.lastNoteAt.delete(pointerId);
    if (!start || !this.config.paint.enabled) return;

    // Tratto brevissimo: nessuna nota è ancora partita, ne emetto una sola.
    // È il tocco singolo, e deve suonare qualcosa o il bambino crede
    // che l'applicazione non funzioni.
    if (performance.now() - start.t < this.config.paint.shortStrokeMs) {
      this.composer.playStrokeNote(swatch, this.degreeFor(y), 0.6, "4n");
    }
  }

  /** Alto = acuto, basso = grave. Due ottave sull'altezza della tela. */
  private degreeFor(y: number) {
    const norm = clamp((y - this.bounds.y) / this.bounds.height, 0, 1);
    const range = scaleLength(this.config.scale) * 2;
    return Math.round((1 - norm) * (range - 1));
  }
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}
