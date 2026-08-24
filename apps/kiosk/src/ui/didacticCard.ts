import type { DidacticCard } from "@kandinsky/schema";
import { store } from "../app/state";
import { t } from "../data/content";

let current: HTMLElement | null = null;
let timer: number | undefined;

/** Card non modale: appare di lato, non ferma la mano del bambino. */
export function showDidacticCard(root: HTMLElement, card: DidacticCard) {
  dismiss();

  const el = document.createElement("div");
  el.className = "didactic";
  el.setAttribute("role", "status");
  el.innerHTML = `
    <h3>${escapeHtml(t(card.title, store.config.locale, store.config.fallbackLocale))}</h3>
    <p>${escapeHtml(t(card.body, store.config.locale, store.config.fallbackLocale))}</p>
  `;
  el.addEventListener("pointerdown", dismiss);

  root.append(el);
  current = el;
  timer = window.setTimeout(dismiss, card.duration);
}

export function dismiss() {
  if (timer) window.clearTimeout(timer);
  if (!current) return;
  const el = current;
  current = null;
  el.classList.add("didactic--out");
  setTimeout(() => el.remove(), 260);
}

function escapeHtml(s: string) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}
