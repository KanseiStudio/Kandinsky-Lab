import type { ElementDefinition, ElementSet } from "@kandinsky/schema";
import { store } from "../app/state";
import { t } from "../data/content";

/**
 * Vassoio degli elementi con drag-to-canvas.
 *
 * Non uso l'HTML Drag & Drop API: su touch non esiste. Il pattern è
 * pointerdown sul vassoio -> ghost che segue il dito -> pointerup che
 * consegna le coordinate allo stage.
 */
/**
 * Vassoio delle forme, innestato nella colonna sinistra sotto i pennelli.
 *
 * Stava a destra, ma su un tavolo orizzontale due colonne di strumenti
 * stringono la tela da entrambi i lati e il bambino deve attraversare tutto
 * il piano per passare da un colore a una forma. Con gli strumenti tutti da
 * una parte la tela guadagna trecento pixel e il braccio resta dove sta.
 */
export function renderElementTray(
  host: HTMLElement,
  elements: ElementDefinition[],
  sets: ElementSet[],
  assetBase: string,
  onDrop: (def: ElementDefinition, clientX: number, clientY: number) => void,
) {
  const label = document.createElement("div");
  label.className = "panel__label";
  label.textContent = "Forme";
  host.append(label);

  // Il contenitore serve alla sfumatura in fondo: senza, un bambino non ha
  // modo di sapere che sotto ci sono altre forme.
  const wrap = document.createElement("div");
  wrap.className = "tray-wrap";

  const tray = document.createElement("div");
  tray.className = "tray";

  // Raggruppamento per opera con intestazioni adesive.
  //
  // Cinquanta forme in una colonna, senza sezioni, si scorrono a caso: il
  // bambino non ritrova due volte la stessa forma e smette di cercare.
  // Le opere sono anche l'unico criterio che ha senso per il curatore.
  const bySet = new Map<string, ElementDefinition[]>();
  for (const def of elements) {
    const key = def.tags.find((t) => sets.some((s) => s.id === t)) ?? "_altri";
    if (!bySet.has(key)) bySet.set(key, []);
    bySet.get(key)!.push(def);
  }

  const ordered = [...sets].sort((a, b) => a.order - b.order);
  for (const set of ordered) {
    const group = bySet.get(set.id);
    if (!group?.length) continue;

    const header = document.createElement("div");
    header.className = "tray__section";
    header.textContent = t(set.label, store.config.locale, store.config.fallbackLocale);
    tray.append(header);
    renderItems(group);
  }
  const altri = bySet.get("_altri");
  if (altri?.length) renderItems(altri);

  function renderItems(group: ElementDefinition[]) {
  group.forEach((def) => {
    const item = document.createElement("button");
    item.className = "tray__item";
    item.setAttribute("aria-label", t(def.label, store.config.locale));
    item.innerHTML = `<img src="${assetBase}/${def.asset.file}" alt="" />`;

    item.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      startDrag(def, e, assetBase, onDrop);
    });

    tray.append(item);
  });
  }

  wrap.append(tray);
  host.append(wrap);
  return wrap;
}

function startDrag(
  def: ElementDefinition,
  origin: PointerEvent,
  assetBase: string,
  onDrop: (def: ElementDefinition, x: number, y: number) => void,
) {
  const ghost = document.createElement("img");
  ghost.className = "drag-ghost";
  ghost.src = `${assetBase}/${def.asset.file}`;
  ghost.style.left = `${origin.clientX}px`;
  ghost.style.top = `${origin.clientY}px`;
  document.body.append(ghost);

  const move = (e: PointerEvent) => {
    if (e.pointerId !== origin.pointerId) return;
    ghost.style.left = `${e.clientX}px`;
    ghost.style.top = `${e.clientY}px`;
  };

  const up = (e: PointerEvent) => {
    if (e.pointerId !== origin.pointerId) return;
    ghost.remove();
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    onDrop(def, e.clientX, e.clientY);
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}
