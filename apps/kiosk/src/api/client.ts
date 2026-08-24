import type { ArtworkSubmission } from "@kandinsky/schema";
import { store } from "../app/state";

/**
 * Client verso il server locale.
 *
 * Il chiosco NON deve mai bloccare il bambino in attesa della rete.
 * L'opera viene accodata in localStorage e ritentata in background:
 * se il wifi del museo cade a metà mattina, le opere partono dopo,
 * e nel frattempo l'esperienza continua.
 */
const QUEUE_KEY = "kandinsky.outbox";

/**
 * In produzione l'esperienza è servita dallo stesso server delle API, quindi
 * l'indirizzo giusto è la propria origine. In sviluppo Vite sta sulla 5180 e
 * il server sull'8787, e serve l'indirizzo assoluto della configurazione.
 */
function apiBase() {
  const configurato = store.config.server.baseUrl?.trim();
  return configurato || window.location.origin;
}

export async function submitArtwork(payload: ArtworkSubmission): Promise<"sent" | "queued"> {
  const sizeMb = (payload.imageBase64.length * 0.75) / 1024 / 1024;
  console.log(
    `[outbox] opera ${payload.sessionId} — immagine ${sizeMb.toFixed(1)} MB, ` +
      `email ${payload.email ? "presente" : "assente"}`,
  );
  enqueue(payload);
  const ok = await flush();
  return ok ? "sent" : "queued";
}

/** Ultimo errore di invio, leggibile da console: `__kandinsky.outboxError`. */
export let lastOutboxError: string | null = null;

export async function flush(): Promise<boolean> {
  const queue = readQueue();
  if (!queue.length) return true;

  let allSent = true;
  for (const item of [...queue]) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), store.config.server.timeoutMs);
      const res = await fetch(`${apiBase()}/api/artworks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        // Il corpo dell'errore contiene la causa vera: un 400 di validazione
        // e un 413 di payload troppo grande richiedono rimedi opposti.
        const body = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText} ${body.slice(0, 300)}`);
      }
      dequeue(item.sessionId);
      lastOutboxError = null;
      console.log(`[outbox] consegnata al server: ${item.sessionId}`);
    } catch (err: any) {
      lastOutboxError = String(err?.message ?? err);
      // Il fallimento silenzioso è il difetto peggiore di una coda:
      // l'opera resta lì per sempre e nessuno sa perché.
      console.error(`[outbox] invio fallito: ${lastOutboxError}`);
      allSent = false;
      break; // il server è giù: inutile martellare sugli altri
    }
  }
  return allSent;
}

/** Ritenta ogni 30s finché la coda non è vuota. */
export function startOutboxWorker() {
  window.setInterval(() => void flush(), 30_000);
  window.addEventListener("online", () => void flush());
}

export function pendingCount() {
  return readQueue().length;
}

function readQueue(): ArtworkSubmission[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeQueue(q: ArtworkSubmission[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

function enqueue(item: ArtworkSubmission) {
  const q = readQueue();
  q.push(item);
  // Tetto di sicurezza: 40 PNG full-res saturano lo storage del browser.
  writeQueue(q.slice(-40));
}

function dequeue(sessionId: string) {
  writeQueue(readQueue().filter((i) => i.sessionId !== sessionId));
}
