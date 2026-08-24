/**
 * Puntatore circolare per il mouse.
 *
 * In sala non serve: il cursore è nascosto e i tocchi non ne hanno bisogno.
 * In sviluppo invece è indispensabile, perché con `cursor: none` si perde
 * completamente il riferimento di dove si sta per toccare.
 *
 * Compare SOLO per `pointerType === "mouse"` e sparisce al primo tocco:
 * così non va disattivato prima di andare in sala, si toglie da solo.
 */
export class PointerHalo {
  readonly element: HTMLDivElement;
  private visible = false;
  private raf = 0;
  private x = -100;
  private y = -100;

  constructor(private getBrushSize: () => number, private getColor: () => string) {
    this.element = document.createElement("div");
    this.element.className = "pointer-halo";
    document.body.append(this.element);

    window.addEventListener("pointermove", (e) => this.onMove(e), { passive: true });
    window.addEventListener("pointerdown", (e) => this.onDown(e), { passive: true });
    window.addEventListener("pointerup", () => this.element.classList.remove("pointer-halo--down"));
    window.addEventListener("pointerleave", () => this.hide());

    const frame = () => {
      if (this.visible) {
        const d = Math.max(18, this.getBrushSize());
        this.element.style.transform = `translate(${this.x}px, ${this.y}px) translate(-50%, -50%)`;
        this.element.style.width = `${d}px`;
        this.element.style.height = `${d}px`;
        this.element.style.borderColor = this.getColor();
      }
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  private onMove(e: PointerEvent) {
    if (e.pointerType !== "mouse") return this.hide();
    this.x = e.clientX;
    this.y = e.clientY;
    if (!this.visible) {
      this.visible = true;
      this.element.classList.add("pointer-halo--on");
    }
  }

  private onDown(e: PointerEvent) {
    if (e.pointerType !== "mouse") return;
    this.element.classList.add("pointer-halo--down");
  }

  private hide() {
    this.visible = false;
    this.element.classList.remove("pointer-halo--on");
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.element.remove();
  }
}
