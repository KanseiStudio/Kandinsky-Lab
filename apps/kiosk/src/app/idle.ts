import { store } from "./state";

/**
 * Reset di sala. Su un tavolo museale il caso più frequente non è
 * "il bambino finisce l'opera", è "il bambino se ne va a metà".
 * Senza questo, alle 11 del mattino la tela è un pastrocchio di venti sessioni.
 *
 * L'avviso prima del reset è obbligatorio: azzerare il lavoro di un bambino
 * che si era solo distratto è il modo più veloce per farlo piangere.
 */
export class IdleWatcher {
  private lastActivity = Date.now();
  private warned = false;
  private timer?: number;

  constructor(
    private warningAfterSec: number,
    private resetAfterSec: number,
    private onWarn: (secondsLeft: number) => void,
    private onReset: () => void,
    private onResume: () => void,
  ) {
    store.on("activity", () => this.touch());
    document.addEventListener("pointerdown", () => this.touch(), true);
  }

  start() {
    this.stop();
    this.touch();
    this.timer = window.setInterval(() => this.tick(), 1000);
  }

  stop() {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = undefined;
  }

  touch() {
    this.lastActivity = Date.now();
    if (this.warned) {
      this.warned = false;
      this.onResume();
    }
  }

  private tick() {
    if (store.state.screen === "welcome") return;
    const idleSec = (Date.now() - this.lastActivity) / 1000;

    if (idleSec >= this.warningAfterSec + this.resetAfterSec) {
      this.warned = false;
      this.onReset();
      return;
    }
    if (idleSec >= this.warningAfterSec) {
      this.warned = true;
      this.onWarn(Math.ceil(this.warningAfterSec + this.resetAfterSec - idleSec));
    }
  }
}
