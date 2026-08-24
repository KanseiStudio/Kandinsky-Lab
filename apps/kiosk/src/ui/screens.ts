import { renderKeyboard } from "./keyboard";

type Cleanup = () => void;

function mount(root: HTMLElement, node: HTMLElement): Cleanup {
  root.append(node);
  return () => node.remove();
}

/** FASE 1 — Welcome. Deve leggersi da tre metri e da qualsiasi lato del tavolo. */
export function welcomeScreen(root: HTMLElement, onStart: () => void): Cleanup {
  const el = document.createElement("section");
  el.className = "screen";
  el.innerHTML = `
    <div class="hero-mark" id="hero-mark"></div>
    <h1>Crea il tuo Kandinsky</h1>
    <p>Colora, combina le forme, inventa un quadro che non esisteva.</p>
    <button class="btn btn--primary btn--xl" id="start">Inizia</button>
  `;
  el.querySelector<HTMLButtonElement>("#start")!.onclick = onStart;
  animateHeroMark(el.querySelector<HTMLElement>("#hero-mark")!);
  return mount(root, el);
}

/**
 * Firma visiva: quattro forme che si ricompongono lentamente sopra il titolo.
 * Non sono decorazione — sono le stesse forme che il bambino troverà nel
 * vassoio, quindi la welcome insegna già il gesto prima ancora del tap.
 */
function animateHeroMark(host: HTMLElement) {
  const shapes = [
    { html: `<circle cx="60" cy="60" r="58" fill="#1B3A93"/>`, x: 30, y: 40, size: 120, speed: 9000 },
    { html: `<polygon points="70,0 140,130 0,130" fill="#F2C300"/>`, x: 220, y: 20, size: 140, speed: 11000 },
    { html: `<rect width="110" height="110" fill="#D62828"/>`, x: 380, y: 120, size: 110, speed: 13000 },
    { html: `<path d="M0 90 A90 90 0 0 1 180 90" stroke="#141414" stroke-width="10" fill="none"/>`, x: 120, y: 170, size: 180, speed: 15000 },
  ];

  shapes.forEach((s, i) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${s.size} ${s.size}`);
    svg.setAttribute("width", String(s.size));
    svg.setAttribute("height", String(s.size));
    svg.innerHTML = s.html;
    svg.classList.add("hero-mark__shape");
    svg.style.left = `${s.x}px`;
    svg.style.top = `${s.y}px`;
    svg.animate(
      [
        { transform: "translate(0,0) rotate(0deg)" },
        { transform: `translate(${(i % 2 ? -1 : 1) * 18}px, ${-14 - i * 3}px) rotate(${(i % 2 ? -1 : 1) * 8}deg)` },
        { transform: "translate(0,0) rotate(0deg)" },
      ],
      { duration: s.speed, iterations: Infinity, easing: "ease-in-out" },
    );
    host.append(svg);
  });
}

/** Rivelazione dell'opera a pieno schermo, prima del titolo. */
export function reviewScreen(
  root: HTMLElement,
  previewUrl: string,
  onContinue: () => void,
  onBack: () => void,
): Cleanup {
  const el = document.createElement("section");
  el.className = "screen";
  el.innerHTML = `
    <img src="${previewUrl}" alt="La tua opera" class="review-image" />
    <h2>Ecco la tua opera</h2>
    <div class="screen__actions">
      <button class="btn" id="back">Continua a dipingere</button>
      <button class="btn btn--primary btn--xl" id="next">Dalle un nome</button>
    </div>
  `;
  el.querySelector<HTMLButtonElement>("#back")!.onclick = onBack;
  el.querySelector<HTMLButtonElement>("#next")!.onclick = onContinue;
  return mount(root, el);
}

export function titleScreen(root: HTMLElement, onDone: (title: string) => void): Cleanup {
  const el = document.createElement("section");
  el.className = "screen";
  el.innerHTML = `
    <h2>Dai un nome alla tua opera</h2>
    <input class="field" id="title" readonly placeholder="Senza titolo" />
    <div id="kb"></div>
    <button class="btn btn--primary btn--xl" id="done">Fatto</button>
  `;
  const field = el.querySelector<HTMLInputElement>("#title")!;
  const kb = renderKeyboard(el.querySelector<HTMLElement>("#kb")!, "letters", (v) => {
    field.value = v.slice(0, 40);
  });
  el.querySelector<HTMLButtonElement>("#done")!.onclick = () => onDone(kb.value.trim());
  return mount(root, el);
}

/**
 * Raccolta e-mail.
 * Il testo è rivolto all'adulto, non al bambino: è l'adulto che presta
 * il consenso e che riceve la mail. Il consenso è esplicito e versionato,
 * e la finalità è dichiarata sullo stesso schermo del campo.
 */
export function emailScreen(
  root: HTMLElement,
  onSend: (email: string) => void,
  onSkip: () => void,
): Cleanup {
  const el = document.createElement("section");
  el.className = "screen";
  el.innerHTML = `
    <h2>Vuoi ricevere la tua opera?</h2>
    <p>Chiedi a un adulto di scrivere qui la sua e-mail. La usiamo solo per inviare
       questo disegno e la cancelliamo subito dopo. Nessuna newsletter.</p>
    <input class="field" id="email" readonly placeholder="nome@esempio.it" />
    <div id="kb"></div>
    <label style="display:flex;gap:16px;align-items:center;font-size:20px;max-width:60ch">
      <input type="checkbox" id="consent" style="width:40px;height:40px" />
      Ho letto l'informativa e acconsento all'invio dell'opera a questo indirizzo.
    </label>
    <div style="display:flex;gap:24px">
      <button class="btn" id="skip">No, grazie</button>
      <button class="btn btn--primary btn--xl" id="send" disabled>Invia l'opera</button>
    </div>
  `;
  const field = el.querySelector<HTMLInputElement>("#email")!;
  const consent = el.querySelector<HTMLInputElement>("#consent")!;
  const send = el.querySelector<HTMLButtonElement>("#send")!;

  const valid = () => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(field.value) && consent.checked;
  const refresh = () => (send.disabled = !valid());

  const kb = renderKeyboard(el.querySelector<HTMLElement>("#kb")!, "email", (v) => {
    field.value = v.slice(0, 80);
    refresh();
  });
  consent.onchange = refresh;
  send.onclick = () => onSend(kb.value.trim());
  el.querySelector<HTMLButtonElement>("#skip")!.onclick = onSkip;

  return mount(root, el);
}

export function thanksScreen(root: HTMLElement, queued: boolean, onRestart: () => void): Cleanup {
  const el = document.createElement("section");
  el.className = "screen";
  el.innerHTML = `
    <h1>Hai fatto una cosa nuova</h1>
    <p>${queued
      ? "La tua opera partirà tra poco: la stiamo mettendo in coda."
      : "L'opera è in viaggio verso la casella e-mail."}</p>
    <button class="btn btn--primary btn--xl" id="restart">Ricomincia</button>
  `;
  el.querySelector<HTMLButtonElement>("#restart")!.onclick = onRestart;
  window.setTimeout(onRestart, 12000);
  return mount(root, el);
}

export function idleWarning(root: HTMLElement, seconds: number, onStay: () => void): Cleanup {
  const el = document.createElement("div");
  el.className = "idle-warning";
  el.innerHTML = `
    <h2>Ci sei ancora?</h2>
    <p>Tra <strong id="count">${seconds}</strong> secondi ricominciamo da capo.</p>
    <button class="btn btn--primary btn--xl" id="stay">Sono qui!</button>
  `;
  el.querySelector<HTMLButtonElement>("#stay")!.onclick = onStay;
  return mount(root, el);
}
