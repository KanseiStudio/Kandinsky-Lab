import Konva from "konva";
import type { ElementDefinition, Placement } from "@kandinsky/schema";
import { GestureController } from "./gestures";
import { store } from "../app/state";

interface PlacedElement {
  node: Konva.Image;
  def: ElementDefinition;
  gestures: GestureController;
}

/**
 * Layer degli elementi di Kandinsky posati sulla tela.
 * Ogni elemento è un Konva.Image con drag nativo + gesti a due dita.
 */
export class ElementEngine {
  readonly layer: Konva.Layer;
  private placed = new Map<number, PlacedElement>(); // key = node._id
  private pointerOwner = new Map<number, PlacedElement>(); // pointerId -> elemento
  private selected: PlacedElement | null = null;
  private transformer: Konva.Transformer;
  private images = new Map<string, HTMLImageElement>();
  private zCounter = 0;

  constructor(
    private stage: Konva.Stage,
    private bounds: { x: number; y: number; width: number; height: number },
    private assetBase: string,
    private maxPlacements: number,
  ) {
    this.layer = new Konva.Layer();
    this.layer.clip({ ...this.bounds });

    this.transformer = new Konva.Transformer({
      // Maniglie sovradimensionate: il target touch minimo per un bambino
      // è ben oltre i 44px delle linee guida per adulti.
      anchorSize: 56,
      anchorCornerRadius: 28,
      anchorStroke: "#141414",
      anchorFill: "#F7F3E8",
      anchorStrokeWidth: 3,
      borderStroke: "#141414",
      borderStrokeWidth: 2,
      borderDash: [10, 8],
      rotateAnchorOffset: 70,
      padding: 14,
      enabledAnchors: ["top-left", "top-right", "bottom-left", "bottom-right"],
      ignoreStroke: true,
    });
    this.layer.add(this.transformer);
    this.stage.add(this.layer);
  }

  /** Precarica tutte le texture prima di aprire l'esperienza: zero attese in sala. */
  async preload(defs: ElementDefinition[]) {
    await Promise.all(
      defs.map(
        (def) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => {
              this.images.set(def.id, img);
              resolve();
            };
            img.onerror = () => {
              console.warn(`[elements] texture mancante: ${def.asset.file}`);
              resolve();
            };
            img.src = `${this.assetBase}/${def.asset.file}`;
          }),
      ),
    );
  }

  /**
   * Istantanea normalizzata per il sequencer. Viene letta a ogni sedicesimo,
   * quindi legge le posizioni CORRENTI dei nodi: se il bambino trascina una
   * forma mentre suona, la musica cambia senza che nulla debba notificarlo.
   */
  snapshot() {
    return [...this.placed.values()].map(({ node, def }) => ({
      nodeId: node._id,
      def,
      x: clamp01((node.x() - this.bounds.x) / this.bounds.width),
      y: clamp01((node.y() - this.bounds.y) / this.bounds.height),
      scale: node.scaleX(),
      rotation: node.rotation(),
    }));
  }

  /**
   * Pulsazione della forma nel momento in cui suona.
   * Sostituisce la linea che scorre sopra il disegno: dice QUALE forma sta
   * suonando, non solo dove siamo nel ciclo, ed è un'informazione migliore.
   */
  pulse(nodeId: number) {
    const entry = this.placed.get(nodeId);
    if (!entry) return;
    const node = entry.node;
    const base = node.scaleX();
    const baseY = node.scaleY();
    node.to({
      scaleX: base * 1.09,
      scaleY: baseY * 1.09,
      duration: 0.09,
      onFinish: () => node.to({ scaleX: base, scaleY: baseY, duration: 0.32 }),
    });
  }

  get selectedElementId() {
    return this.selected?.def.id ?? null;
  }

  get count() {
    return this.placed.size;
  }

  get isFull() {
    return this.placed.size >= this.maxPlacements;
  }

  /** Posa un elemento. x,y in coordinate stage. */
  place(def: ElementDefinition, x: number, y: number, tint: string | null = null): Konva.Image | null {
    const img = this.images.get(def.id);
    if (!img || this.isFull) return null;

    const node = new Konva.Image({
      image: img,
      x,
      y,
      width: def.asset.width / 2, // gli asset sono @2x
      height: def.asset.height / 2,
      offsetX: (def.asset.width / 2) * def.asset.anchor.x,
      offsetY: (def.asset.height / 2) * def.asset.anchor.y,
      scaleX: def.behaviour.defaultScale,
      scaleY: def.behaviour.defaultScale,
      draggable: true,
      dragDistance: 6,
      perfectDrawEnabled: false,
      shadowForStrokeEnabled: false,
    });

    node.setAttr("elementId", def.id);
    node.setAttr("z", this.zCounter++);

    if (tint && def.asset.tintable) {
      node.cache();
      node.filters([Konva.Filters.RGB]);
      applyTint(node, tint);
    }

    // Il nodo non può uscire del tutto dalla tela: un elemento perso
    // fuori bordo è un elemento che il bambino non può più recuperare.
    node.dragBoundFunc((pos) => this.constrain(pos));

    const entry: PlacedElement = {
      node,
      def,
      gestures: new GestureController(
        node,
        {
          minScale: def.behaviour.minScale,
          maxScale: def.behaviour.maxScale,
          rotatable: def.behaviour.rotatable,
          aspectLocked: def.behaviour.aspectLocked,
        },
        () => this.layer.batchDraw(),
      ),
    };

    node.on("pointerdown", () => this.select(entry));
    node.on("dragstart", () => this.select(entry));

    this.placed.set(node._id, entry);
    this.layer.add(node);
    this.select(entry);
    this.layer.batchDraw();

    store.emit("element:placed", { elementId: def.id, total: this.placed.size });
    return node;
  }

  /** Instrada un pointer verso l'elemento che lo possiede, per i gesti multi-dito. */
  routePointerDown(pointerId: number, x: number, y: number): boolean {
    const shape = this.layer.getIntersection({ x, y });
    if (!shape) return false;
    const entry = this.placed.get(shape._id);
    if (!entry) return false;

    // Con due dita sospendo il drag nativo: i due sistemi non devono convivere.
    entry.gestures.down(pointerId, x, y);
    if (entry.gestures.activePointers >= 2) {
      entry.node.stopDrag();
      entry.node.draggable(false);
    }
    this.pointerOwner.set(pointerId, entry);
    this.select(entry);
    return true;
  }

  routePointerMove(pointerId: number, x: number, y: number): boolean {
    const entry = this.pointerOwner.get(pointerId);
    if (!entry) return false;
    return entry.gestures.move(pointerId, x, y);
  }

  routePointerUp(pointerId: number) {
    const entry = this.pointerOwner.get(pointerId);
    if (!entry) return;
    entry.gestures.up(pointerId);
    this.pointerOwner.delete(pointerId);
    if (entry.gestures.activePointers === 0) {
      entry.node.draggable(true);
    }
  }

  select(entry: PlacedElement | null) {
    this.selected = entry;
    if (!entry) {
      this.transformer.nodes([]);
    } else {
      entry.node.moveToTop();
      entry.node.setAttr("z", this.zCounter++);
      this.transformer.nodes([entry.node]);
      this.transformer.moveToTop();
      this.transformer.rotateEnabled(entry.def.behaviour.rotatable);
      this.transformer.keepRatio(entry.def.behaviour.aspectLocked);
    }
    this.layer.batchDraw();
    store.emit("element:selected", { elementId: entry?.def.id ?? null });
  }

  deselect() {
    this.select(null);
  }

  removeSelected() {
    if (!this.selected) return;
    this.placed.delete(this.selected.node._id);
    this.selected.node.destroy();
    this.select(null);
  }

  duplicateSelected() {
    if (!this.selected || !this.selected.def.behaviour.duplicable || this.isFull) return;
    const src = this.selected.node;
    this.place(this.selected.def, src.x() + 48, src.y() + 48);
  }

  clear() {
    this.select(null);
    for (const { node } of this.placed.values()) node.destroy();
    this.placed.clear();
    this.layer.batchDraw();
  }

  /** Serializza la composizione: permette ristampe e riaperture senza il PNG. */
  serialize(): Placement[] {
    return [...this.placed.values()]
      .map(({ node, def }) => ({
        elementId: def.id,
        x: Math.round(node.x() - this.bounds.x),
        y: Math.round(node.y() - this.bounds.y),
        scaleX: round3(node.scaleX()),
        scaleY: round3(node.scaleY()),
        rotation: round3(node.rotation()),
        tint: (node.getAttr("tint") as string) ?? null,
        z: node.getAttr("z") as number,
      }))
      .sort((a, b) => a.z - b.z);
  }

  private constrain(pos: { x: number; y: number }) {
    const margin = 80; // quanto può sporgere fuori tela
    return {
      x: Math.min(this.bounds.x + this.bounds.width + margin, Math.max(this.bounds.x - margin, pos.x)),
      y: Math.min(this.bounds.y + this.bounds.height + margin, Math.max(this.bounds.y - margin, pos.y)),
    };
  }
}

function applyTint(node: Konva.Image, hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  node.red(r);
  node.green(g);
  node.blue(b);
  node.setAttr("tint", hex);
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}
