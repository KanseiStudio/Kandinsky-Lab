import Konva from "konva";

interface PointerSample {
  id: number;
  x: number;
  y: number;
}

/**
 * Pinch + rotate a due dita su un singolo nodo Konva.
 *
 * Konva.Transformer da solo copre il caso "maniglie", che funziona ma è
 * innaturale per un bambino di sei anni. Il gesto diretto a due dita è il
 * comportamento che i bambini provano per primo, quindi deve esserci.
 *
 * Regole:
 * - il primo dito che tocca il nodo lo trascina (drag nativo di Konva);
 * - il secondo dito attiva pinch/rotate e SOSPENDE il drag, altrimenti i due
 *   sistemi si combattono e l'elemento schizza via;
 * - alzando un dito si torna al drag con il dito rimasto, senza salti.
 */
export class GestureController {
  private pointers = new Map<number, PointerSample>();
  private origin: {
    distance: number;
    angle: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
    center: { x: number; y: number };
    nodePos: { x: number; y: number };
  } | null = null;

  constructor(
    private node: Konva.Node,
    private limits: { minScale: number; maxScale: number; rotatable: boolean; aspectLocked: boolean },
    private onChange?: () => void,
  ) {}

  get activePointers() {
    return this.pointers.size;
  }

  down(id: number, x: number, y: number) {
    this.pointers.set(id, { id, x, y });
    if (this.pointers.size === 2) this.captureOrigin();
  }

  move(id: number, x: number, y: number) {
    const p = this.pointers.get(id);
    if (!p) return false;
    p.x = x;
    p.y = y;

    if (this.pointers.size < 2 || !this.origin) return false;

    const [a, b] = [...this.pointers.values()];
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

    const ratio = distance / this.origin.distance;
    const nextScale = clamp(this.origin.scaleX * ratio, this.limits.minScale, this.limits.maxScale);

    this.node.scaleX(nextScale);
    this.node.scaleY(
      this.limits.aspectLocked
        ? nextScale
        : clamp(this.origin.scaleY * ratio, this.limits.minScale, this.limits.maxScale),
    );

    if (this.limits.rotatable) {
      this.node.rotation(this.origin.rotation + (angle - this.origin.angle));
    }

    // Il nodo segue lo spostamento del punto medio fra le due dita:
    // senza questo la forma "scappa" mentre si pizzica.
    this.node.position({
      x: this.origin.nodePos.x + (center.x - this.origin.center.x),
      y: this.origin.nodePos.y + (center.y - this.origin.center.y),
    });

    this.onChange?.();
    return true;
  }

  up(id: number) {
    this.pointers.delete(id);
    this.origin = null;
    // Con un dito rimasto si riparte da capo, così il drag non salta.
    if (this.pointers.size === 1) this.captureOrigin();
  }

  reset() {
    this.pointers.clear();
    this.origin = null;
  }

  private captureOrigin() {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) {
      this.origin = null;
      return;
    }
    const [a, b] = pts;
    this.origin = {
      distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
      scaleX: this.node.scaleX(),
      scaleY: this.node.scaleY(),
      rotation: this.node.rotation(),
      center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      nodePos: { x: this.node.x(), y: this.node.y() },
    };
  }
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}
