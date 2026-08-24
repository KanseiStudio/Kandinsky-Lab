import Konva from "konva";
import type { BrushPreset, ElementDefinition, KioskConfig } from "@kandinsky/schema";
import { PaintEngine } from "./paint";
import { ElementEngine } from "./elements";
import { store } from "../app/state";

/**
 * Orchestratore della tela.
 *
 * Il routing dei pointer è centralizzato qui e non delegato a Konva:
 * serve sapere, per OGNI dito, se sta manipolando un elemento o dipingendo.
 * Konva instrada bene il singolo puntatore, molto meno bene sei dita
 * contemporanee su un tavolo da 1920x1080.
 */
export interface PaintHooks {
  onBegin?: (pointerId: number, x: number, y: number) => void;
  onMove?: (pointerId: number, x: number, y: number) => void;
  onEnd?: (pointerId: number, x: number, y: number) => void;
}

export class CanvasStage {
  readonly stage: Konva.Stage;
  readonly paint: PaintEngine;
  readonly elements: ElementEngine;
  private artboard: { x: number; y: number; width: number; height: number };
  /** Sfondo della tela, esportato insieme al resto */
  private backgroundLayer: Konva.Layer;

  constructor(
    container: HTMLDivElement,
    private config: KioskConfig & { canvasBackground?: string },
    defaultBrush: BrushPreset,
    assetBase: string,
    private hooks: PaintHooks = {},
  ) {
    this.artboard = config.canvas.artboard;

    this.stage = new Konva.Stage({
      container,
      width: config.canvas.width,
      height: config.canvas.height,
    });

    this.backgroundLayer = new Konva.Layer({ listening: false });
    this.backgroundLayer.add(
      new Konva.Rect({
        ...this.artboard,
        fill: config.canvasBackground ?? "#F7F3E8",
        cornerRadius: 4,
      }),
    );
    this.stage.add(this.backgroundLayer);

    this.paint = new PaintEngine(this.stage, this.artboard, defaultBrush);
    this.elements = new ElementEngine(this.stage, this.artboard, assetBase, config.maxPlacements);

    this.bindPointers(container);
  }

  /**
   * Lo stage resta SEMPRE a 1920x1080 con scala 1.
   *
   * L'adattamento allo schermo lo fa la trasformazione CSS su #frame, che
   * scala tutto insieme. La versione precedente scalava anche lo stage, e il
   * risultato era una doppia scala (s x s): il punto toccato non coincideva
   * con il punto disegnato, e il ritaglio dell'export era spostato.
   *
   * Conseguenza importante: le coordinate passate a `toDataURL` sono quelle
   * di progetto, senza conversioni. Se qualcuno reintroduce lo scaling qui,
   * l'export si disallinea di nuovo.
   */
  private get renderedScale() {
    const rect = this.stage.container().getBoundingClientRect();
    // Ricavata dal rettangolo reale invece che ricalcolata: resta corretta
    // qualunque cosa faccia il CSS sopra di noi.
    return rect.width / this.config.canvas.width || 1;
  }

  get displayScale() {
    return this.renderedScale;
  }

  private toStageCoords(e: PointerEvent) {
    const rect = this.stage.container().getBoundingClientRect();
    const s = this.renderedScale;
    return {
      x: (e.clientX - rect.left) / s,
      y: (e.clientY - rect.top) / s,
    };
  }

  private bindPointers(container: HTMLElement) {
    // touch-action: none è indispensabile, altrimenti Chrome intercetta
    // pinch e scroll prima che arrivino all'applicazione.
    container.style.touchAction = "none";

    container.addEventListener("pointerdown", (e) => {
      container.setPointerCapture(e.pointerId);
      const { x, y } = this.toStageCoords(e);
      store.emit("activity", {});

      // Priorità: un dito che tocca un elemento manipola, non dipinge.
      if (this.elements.routePointerDown(e.pointerId, x, y)) return;

      // Tocco a vuoto dentro la tela: deseleziono e dipingo.
      this.elements.deselect();
      this.paint.begin(e.pointerId, x, y, e.pressure || 0.5);
      if (this.paint.isInside(x, y)) this.hooks.onBegin?.(e.pointerId, x, y);
    });

    container.addEventListener("pointermove", (e) => {
      const { x, y } = this.toStageCoords(e);
      if (this.elements.routePointerMove(e.pointerId, x, y)) return;
      this.paint.extend(e.pointerId, x, y, e.pressure || 0.5);
      if (this.paint.isInside(x, y)) this.hooks.onMove?.(e.pointerId, x, y);
    });

    const release = (e: PointerEvent) => {
      const { y } = this.toStageCoords(e);
      this.elements.routePointerUp(e.pointerId);
      this.paint.end(e.pointerId);
      this.hooks.onEnd?.(e.pointerId, 0, y);
    };
    container.addEventListener("pointerup", release);
    container.addEventListener("pointercancel", release);
    container.addEventListener("pointerleave", release);
  }

  /** Drop di un elemento dal pannello laterale. */
  dropElement(def: ElementDefinition, clientX: number, clientY: number, tint: string | null = null) {
    const rect = this.stage.container().getBoundingClientRect();
    const s = this.renderedScale;
    const x = (clientX - rect.left) / s;
    const y = (clientY - rect.top) / s;

    // Drop fuori tela: lo porto al centro invece di scartarlo.
    // Un bambino che molla il dito troppo presto non deve perdere il gesto.
    const inside =
      x >= this.artboard.x &&
      x <= this.artboard.x + this.artboard.width &&
      y >= this.artboard.y &&
      y <= this.artboard.y + this.artboard.height;

    return this.elements.place(
      def,
      inside ? x : this.artboard.x + this.artboard.width / 2,
      inside ? y : this.artboard.y + this.artboard.height / 2,
      tint,
    );
  }

  undo() {
    // L'undo è unificato: l'ultima azione, che sia tratto o elemento.
    // Distinguere due stack separati confonde chiunque, non solo i bambini.
    this.paint.undo();
  }

  clearAll() {
    this.paint.clear();
    this.elements.clear();
  }

  get artboardRect() {
    return this.artboard;
  }
}
