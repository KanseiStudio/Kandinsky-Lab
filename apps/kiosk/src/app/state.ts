import type { BrushPreset, KioskConfig, Palette } from "@kandinsky/schema";
import { sessionId } from "./uuid";

export type Screen = "welcome" | "studio" | "review" | "title" | "email" | "thanks";

export interface SessionState {
  sessionId: string;
  startedAt: number;
  screen: Screen;
  paletteId: string;
  colorId: string;
  brushId: BrushPreset["id"];
  title: string;
  stats: {
    strokeCount: number;
    placementCount: number;
    undoCount: number;
    clearCount: number;
    cardsShown: string[];
  };
}

type Listener = (payload: any) => void;

/**
 * Store minimale a eventi. Niente framework: l'app ha sei schermate,
 * un reducer da 40 righe regge meglio di React su un chiosco che deve
 * restare acceso otto ore al giorno senza perdere un frame.
 */
class Store {
  private listeners = new Map<string, Set<Listener>>();
  state!: SessionState;
  config!: KioskConfig;
  palette!: Palette;

  init(config: KioskConfig, palette: Palette) {
    this.config = config;
    this.palette = palette;
    this.newSession();
  }

  newSession() {
    this.state = {
      sessionId: sessionId(),
      startedAt: Date.now(),
      screen: "welcome",
      paletteId: this.palette.id,
      colorId: this.palette.swatches[0].id,
      brushId: "brush",
      title: "",
      stats: { strokeCount: 0, placementCount: 0, undoCount: 0, clearCount: 0, cardsShown: [] },
    };
    this.emit("session:new", this.state);
  }

  get currentColor() {
    return this.palette.swatches.find((s) => s.id === this.state.colorId)!.hex;
  }

  setScreen(screen: Screen) {
    this.state.screen = screen;
    this.emit("screen", screen);
  }

  on(event: string, fn: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
    return () => this.listeners.get(event)!.delete(fn);
  }

  emit(event: string, payload: any = {}) {
    this.listeners.get(event)?.forEach((fn) => fn(payload));
    if (event !== "activity") this.listeners.get("*")?.forEach((fn) => fn({ event, payload }));
  }
}

export const store = new Store();
