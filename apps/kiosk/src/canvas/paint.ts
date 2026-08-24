import Konva from "konva";
import type { BrushPreset } from "@kandinsky/schema";
import { store } from "../app/state";

interface ActiveStroke {
  line: Konva.Line;
  lastX: number;
  lastY: number;
}

/**
 * Layer di pittura a mano libera.
 *
 * Punto chiave per il tavolo touch: ogni pointerId ha il PROPRIO tratto attivo.
 * Su un tavolo orizzontale due bambini dipingono insieme, e con un singolo
 * "current line" i due tratti si fondono in una linea che salta da una mano
 * all'altra. La mappa activeStrokes risolve questo.
 *
 * L'undo lavora per tratto: ogni Konva.Line è un'unità atomica.
 */
export class PaintEngine {
  readonly layer: Konva.Layer;
  private activeStrokes = new Map<number, ActiveStroke>();
  private history: Konva.Line[] = [];
  private redoStack: Konva.Line[] = [];
  private brush: BrushPreset;
  private color = "#141414";
  private enabled = true;

  constructor(
    private stage: Konva.Stage,
    private bounds: { x: number; y: number; width: number; height: number },
    initialBrush: BrushPreset,
  ) {
    this.brush = initialBrush;
    this.layer = new Konva.Layer({ listening: false });

    // Clip sull'artboard: si dipinge dentro la tela, non sui pannelli laterali.
    this.layer.clip({ ...this.bounds });
    this.stage.add(this.layer);
  }

  setBrush(brush: BrushPreset) {
    this.brush = brush;
  }

  setColor(hex: string) {
    this.color = hex;
  }

  /** Disattivato mentre si manipola un elemento, altrimenti si dipinge per sbaglio. */
  setEnabled(v: boolean) {
    this.enabled = v;
    if (!v) this.activeStrokes.clear();
  }

  isInside(x: number, y: number) {
    return (
      x >= this.bounds.x &&
      x <= this.bounds.x + this.bounds.width &&
      y >= this.bounds.y &&
      y <= this.bounds.y + this.bounds.height
    );
  }

  begin(pointerId: number, x: number, y: number, pressure = 0.5) {
    if (!this.enabled || !this.isInside(x, y)) return;

    const isEraser = this.brush.id === "eraser";
    const line = new Konva.Line({
      points: [x, y],
      stroke: isEraser ? "#000000" : this.color,
      strokeWidth: this.widthFor(pressure),
      lineCap: "round",
      lineJoin: "round",
      opacity: this.brush.opacity,
      tension: 0.4,
      globalCompositeOperation: isEraser ? "destination-out" : "source-over",
      shadowForStrokeEnabled: false,
      perfectDrawEnabled: false,
      listening: false,
    });

    this.layer.add(line);
    this.activeStrokes.set(pointerId, { line, lastX: x, lastY: y });
    this.redoStack = [];
  }

  extend(pointerId: number, x: number, y: number, pressure = 0.5) {
    const stroke = this.activeStrokes.get(pointerId);
    if (!stroke) return;

    // Fuori dalla tela il tratto si sospende senza chiudersi:
    // il dito può rientrare e continuare lo stesso segno.
    if (!this.isInside(x, y)) return;

    // Scarto i micro-movimenti: riduce di molto i punti sui pannelli capacitivi rumorosi.
    const dx = x - stroke.lastX;
    const dy = y - stroke.lastY;
    if (dx * dx + dy * dy < 4) return;

    const jitter = this.brush.jitter * 3;
    const jx = jitter ? (Math.random() - 0.5) * jitter : 0;
    const jy = jitter ? (Math.random() - 0.5) * jitter : 0;

    stroke.line.points([...stroke.line.points(), x + jx, y + jy]);
    stroke.line.strokeWidth(this.widthFor(pressure));
    stroke.lastX = x;
    stroke.lastY = y;
    this.layer.batchDraw();
  }

  end(pointerId: number) {
    const stroke = this.activeStrokes.get(pointerId);
    if (!stroke) return;
    this.activeStrokes.delete(pointerId);

    // Un tocco singolo senza trascinamento deve comunque lasciare un punto.
    if (stroke.line.points().length <= 2) {
      const [px, py] = stroke.line.points();
      stroke.line.points([px, py, px + 0.1, py + 0.1]);
    }

    this.history.push(stroke.line);
    store.emit("stroke:end", { total: this.history.length });
    this.layer.batchDraw();
  }

  private widthFor(pressure: number) {
    // Gli schermi touch a infrarossi non danno pressione reale (pressure = 0.5 fisso):
    // in quel caso la larghezza resta costante e va bene così.
    const p = 0.6 + pressure * 0.8;
    return this.brush.size * p;
  }

  undo() {
    const line = this.history.pop();
    if (!line) return false;
    line.remove();
    this.redoStack.push(line);
    this.layer.batchDraw();
    return true;
  }

  redo() {
    const line = this.redoStack.pop();
    if (!line) return false;
    this.layer.add(line);
    this.layer.batchDraw();
    this.history.push(line);
    return true;
  }

  clear() {
    this.layer.destroyChildren();
    this.history = [];
    this.redoStack = [];
    this.activeStrokes.clear();
    this.layer.batchDraw();
  }

  get strokeCount() {
    return this.history.length;
  }
}
