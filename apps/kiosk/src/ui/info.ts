/**
 * Spiegazione della linea temporale.
 *
 * Regole di scrittura, e valgono anche per chi la modificherà: frasi corte,
 * verbi al presente, seconda persona singolare, nessuna parola tecnica.
 * Non compaiono "sequencer", "ciclo", "battuta", "timbro". Un bambino di sei
 * anni deve poterla farsi leggere da un adulto e capirla al primo passaggio.
 *
 * Il piccolo disegno conta più del testo: mostra la stessa cosa che sta
 * accadendo sullo schermo, e molti bambini a quell'età leggono l'immagine
 * e saltano le parole.
 */
export function showInfoDialog(root: HTMLElement): () => void {
  const overlay = document.createElement("div");
  overlay.className = "modal";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", "Come funziona la linea in alto");

  overlay.innerHTML = `
    <div class="modal__card">
      <h2>La linea in alto</h2>

      <svg class="modal__figure" viewBox="0 0 520 200" xmlns="http://www.w3.org/2000/svg">
        <!-- la traccia -->
        <line x1="30" y1="40" x2="490" y2="40" stroke="#141414" stroke-width="3"/>
        <circle cx="150" cy="40" r="9" fill="#EFC93B"/>
        <circle cx="300" cy="40" r="9" fill="#C5202E"/>
        <circle cx="420" cy="40" r="9" fill="#1E3E8F"/>
        <!-- il cursore -->
        <rect x="148" y="22" width="4" height="36" fill="#C5202E"/>
        <circle cx="150" cy="16" r="9" fill="#C5202E"/>
        <!-- la tela sotto -->
        <rect x="30" y="80" width="460" height="100" fill="#F2EEDF" stroke="#CFC7B4" stroke-width="2"/>
        <polygon points="150,100 176,150 124,150" fill="#EFC93B"/>
        <circle cx="300" cy="130" r="26" fill="#C5202E"/>
        <rect x="398" y="108" width="44" height="44" fill="#1E3E8F"/>
        <!-- il legame fra i due -->
        <line x1="150" y1="52" x2="150" y2="96" stroke="#C5202E" stroke-width="2" stroke-dasharray="6 5"/>
      </svg>

      <ul class="modal__list">
        <li>Il pallino rosso cammina da sinistra a destra.</li>
        <li>Quando arriva su una forma, quella forma suona.</li>
        <li>Poi torna indietro e ricomincia.</li>
      </ul>

      <p class="modal__tip">
        Prova a spostare una forma: la musica cambia.<br />
        Più in alto la metti, più il suono è acuto.
      </p>

      <button class="btn btn--primary btn--xl" id="modal-close">Ho capito</button>
    </div>
  `;

  const close = () => overlay.remove();
  overlay.querySelector<HTMLButtonElement>("#modal-close")!.onclick = close;
  // Tocco fuori dalla scheda: chiude. Un bambino tocca ovunque, e restare
  // intrappolati in una finestra è il modo più rapido per bloccare la coda.
  overlay.addEventListener("pointerdown", (e) => {
    if (e.target === overlay) close();
  });

  root.append(overlay);
  return close;
}
