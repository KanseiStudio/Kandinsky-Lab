import type { KioskConfig } from "@kandinsky/schema";

export interface PlayheadMark {
  /** posizione normalizzata 0..1 lungo l'artboard */
  x: number;
  color: string;
}

/**
 * Testina di lettura nella barra superiore.
 *
 * Sta fuori dalla tela per tre motivi: non copre il disegno del bambino,
 * non va nascosta al momento dell'export, e la barra superiore era spazio
 * inutilizzato fra il logotipo e "Ho finito".
 *
 * Vincolo non negoziabile: la traccia è allineata **esattamente** all'ampiezza
 * dell'artboard, non alla larghezza dello schermo. Se le due scale divergono,
 * la corrispondenza verticale fra indicatore e forma sottostante si perde e
 * il meccanismo smette di essere leggibile.
 */
export class Playhead {
  readonly element: HTMLDivElement;
  private trackWidth: number;
  private cursor: HTMLDivElement;
  private marksHost: HTMLDivElement;
  private raf = 0;
  private getPosition: () => number = () => 0;

  constructor(config: KioskConfig) {
    const board = config.canvas.artboard;
    this.trackWidth = board.width;

    this.element = document.createElement("div");
    this.element.className = "playhead";
    this.element.style.left = `${board.x}px`;
    this.element.style.width = `${board.width}px`;

    // Battute: quattro tacche che danno il senso del ciclo senza numeri.
    const beats = document.createElement("div");
    beats.className = "playhead__beats";
    for (let i = 0; i < 4; i++) {
      const b = document.createElement("span");
      b.style.left = `${(i / 4) * 100}%`;
      beats.append(b);
    }

    this.marksHost = document.createElement("div");
    this.marksHost.className = "playhead__marks";

    this.cursor = document.createElement("div");
    this.cursor.className = "playhead__cursor";

    this.element.append(beats, this.marksHost, this.cursor);
  }

  bind(getPosition: () => number) {
    this.getPosition = getPosition;
    const frame = () => {
      // In pixel, non in percentuale.
      //
      // Le percentuali di `translateX` si riferiscono alla larghezza
      // DELL'ELEMENTO STESSO, non del contenitore: il cursore è largo 3 px,
      // quindi `translateX(50%)` lo spostava di 1,5 px e sembrava bloccato
      // all'inizio della traccia. I puntini delle forme usano invece `left`,
      // che è relativo al genitore, ed erano infatti posizionati bene.
      this.cursor.style.transform = `translateX(${this.getPosition() * this.trackWidth}px)`;
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  /**
   * Colore della linea di base secondo l'accordo corrente.
   *
   * Visualizza il movimento armonico senza aggiungere elementi: il bambino
   * non deve capire cosa sia una progressione, ma vede che qualcosa cambia
   * quando la musica cambia. E i colori sono quelli della tavolozza in uso,
   * quindi l'informazione resta dentro il linguaggio dell'opera.
   */
  setChordTint(hex: string) {
    this.element.style.setProperty("--playhead-tint", hex);
  }

  /**
   * Puntini che mostrano dove sono le forme lungo il ciclo: la traccia
   * diventa leggibile come una partitura in miniatura, e il bambino vede
   * che spostare una forma la sposta anche qui.
   */
  setMarks(marks: PlayheadMark[]) {
    this.marksHost.replaceChildren(
      ...marks.map((m) => {
        const dot = document.createElement("span");
        dot.style.left = `${m.x * 100}%`;
        dot.style.background = m.color;
        return dot;
      }),
    );
  }

  /** Lampeggio della tacca quando la forma corrispondente suona. */
  flash(x: number, color: string) {
    const spark = document.createElement("span");
    spark.className = "playhead__spark";
    spark.style.left = `${x * 100}%`;
    spark.style.background = color;
    this.marksHost.append(spark);
    setTimeout(() => spark.remove(), 600);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.element.remove();
  }
}
