import type { DidacticCard, DidacticLibrary, ElementDefinition } from "@kandinsky/schema";
import { store } from "./state";

/**
 * Motore dei contenuti didattici.
 *
 * Regole di sala, imparate a caro prezzo su installazioni simili:
 * - mai due card ravvicinate: il bambino smette di leggerle e le chiude a caso;
 * - mai una card che blocca l'interazione: appare di lato e sparisce da sola;
 * - mai la stessa card due volte nella stessa sessione.
 */
export class DidacticEngine {
  private shown = new Map<string, number>();
  private lastShownAt = 0;
  private usedCategories = new Set<string>();
  private usedElements = new Set<string>();
  private usedColors = new Set<string>();

  constructor(
    private library: DidacticLibrary,
    private present: (card: DidacticCard) => void,
  ) {}

  reset() {
    this.shown.clear();
    this.usedCategories.clear();
    this.usedElements.clear();
    this.usedColors.clear();
    this.lastShownAt = 0;
  }

  onElementPlaced(def: ElementDefinition, totalPlacements: number) {
    const candidates: DidacticCard[] = [];

    if (!this.usedElements.has(def.id)) {
      this.usedElements.add(def.id);
      candidates.push(...this.match((c) => c.trigger.on === "element_first_use" && c.trigger.elementId === def.id));
    }
    if (!this.usedCategories.has(def.category)) {
      this.usedCategories.add(def.category);
      candidates.push(...this.match((c) => c.trigger.on === "category_first_use" && c.trigger.category === def.category));
    }
    candidates.push(
      ...this.match((c) => c.trigger.on === "placement_count" && c.trigger.count === totalPlacements),
    );

    this.fire(candidates);
  }

  onColorPicked(swatchId: string) {
    if (this.usedColors.has(swatchId)) return;
    this.usedColors.add(swatchId);
    this.fire(this.match((c) => c.trigger.on === "color_first_use" && c.trigger.swatchId === swatchId));
  }

  onComplete() {
    // La card finale ignora il cooldown: è il momento di chiusura dell'esperienza.
    const cards = this.match((c) => c.trigger.on === "artwork_complete");
    if (cards[0]) this.show(cards[0], true);
  }

  private match(pred: (c: DidacticCard) => boolean) {
    return this.library.cards.filter(
      (c) => c.enabled && pred(c) && (this.shown.get(c.id) ?? 0) < c.maxPerSession,
    );
  }

  private fire(candidates: DidacticCard[]) {
    if (!candidates.length) return;
    if (Date.now() - this.lastShownAt < this.library.globalCooldownMs) return;
    const winner = candidates.sort((a, b) => b.priority - a.priority)[0];
    this.show(winner, false);
  }

  private show(card: DidacticCard, force: boolean) {
    if (!force && Date.now() - this.lastShownAt < this.library.globalCooldownMs) return;
    this.shown.set(card.id, (this.shown.get(card.id) ?? 0) + 1);
    this.lastShownAt = Date.now();
    store.state.stats.cardsShown.push(card.id);
    this.present(card);
  }
}
