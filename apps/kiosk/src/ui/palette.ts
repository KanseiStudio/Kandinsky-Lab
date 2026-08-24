import type { BrushPreset, Palette, Swatch } from "@kandinsky/schema";
import { store } from "../app/state";
import { t } from "../data/content";

export function renderToolPanel(
  root: HTMLElement,
  palette: Palette,
  brushes: BrushPreset[],
  onColor: (s: Swatch) => void,
  onBrush: (b: BrushPreset) => void,
) {
  const panel = document.createElement("aside");
  panel.className = "panel panel--tools";
  panel.innerHTML = `<div class="panel__label">Colori</div>`;

  const swatches = document.createElement("div");
  swatches.className = "swatches";
  palette.swatches.forEach((s, i) => {
    const b = document.createElement("button");
    b.className = "swatch";
    b.style.background = s.hex;
    b.setAttribute("aria-pressed", String(i === 0));
    b.setAttribute("aria-label", t(s.label, store.config.locale) || s.id);
    b.onclick = () => {
      swatches.querySelectorAll(".swatch").forEach((el) => el.setAttribute("aria-pressed", "false"));
      b.setAttribute("aria-pressed", "true");
      onColor(s);
    };
    swatches.append(b);
  });
  panel.append(swatches);

  const label = document.createElement("div");
  label.className = "panel__label";
  label.textContent = "Pennelli";
  panel.append(label);

  const tools = document.createElement("div");
  tools.className = "tools";
  brushes.forEach((br, i) => {
    const b = document.createElement("button");
    b.className = "tool";
    b.setAttribute("aria-pressed", String(i === 0));
    b.setAttribute("aria-label", t(br.label, store.config.locale));
    b.innerHTML = `<img src="/content/assets/${br.icon}" alt="" />`;
    b.onclick = () => {
      tools.querySelectorAll(".tool").forEach((el) => el.setAttribute("aria-pressed", "false"));
      b.setAttribute("aria-pressed", "true");
      onBrush(br);
    };
    tools.append(b);
  });
  panel.append(tools);

  root.append(panel);
  return panel;
}
