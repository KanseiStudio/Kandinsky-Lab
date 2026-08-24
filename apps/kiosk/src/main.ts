/**
 * Font impacchettati, non scaricati.
 *
 * Vengono da npm e finiscono nel bundle: il chiosco parte col cavo staccato e
 * non c'è nessun percorso /fonts/ da tenere allineato.
 *
 * Atkinson Hyperlegible è scelto per il corpo testo perché distingue le forme
 * ambigue (I / l / 1, O / 0): serve ai bambini che stanno imparando a leggere
 * e ai visitatori ipovedenti. Entrambi i caratteri sono SIL OFL.
 *
 * Prendiamo solo l'asse di peso del carattere variabile e il solo sottoinsieme
 * latino: gli altri assi (larghezza, dimensione ottica) e gli alfabeti che non
 * usiamo peserebbero mezzo megabyte per nulla. L'italiano sta tutto nel latino
 * di base, accenti compresi.
 */
import "@fontsource-variable/bricolage-grotesque/wght.css";
import "@fontsource/atkinson-hyperlegible/latin-400.css";
import "@fontsource/atkinson-hyperlegible/latin-700.css";

import "./styles/tokens.css";
import "./styles/app.css";

import type { BrushPreset, ElementDefinition } from "@kandinsky/schema";
import { loadContent } from "./data/content";
import { store } from "./app/state";
import { IdleWatcher } from "./app/idle";
import { DidacticEngine } from "./app/didactics";
import { CanvasStage } from "./canvas/stage";
import { exportArtwork, exportPreview } from "./canvas/export";
import { renderToolPanel } from "./ui/palette";
import { renderElementTray } from "./ui/tray";
import { showDidacticCard, dismiss as dismissCard } from "./ui/didacticCard";
import * as screens from "./ui/screens";
import { lastOutboxError, startOutboxWorker, submitArtwork } from "./api/client";
import { AudioEngine } from "./audio/engine";
import { Composer } from "./audio/composer";
import { PaintVoice } from "./audio/paintVoice";
import { Sequencer } from "./audio/sequencer";
import { Playhead } from "./ui/playhead";
import { PointerHalo } from "./ui/pointer";
import { showInfoDialog } from "./ui/info";

const ASSET_BASE = "/content/assets";

async function boot() {
  const content = await loadContent();
  const palette = content.palettes.palettes.find((p) => p.id === content.config.paletteId)!;
  store.init(content.config, palette);

  const frame = document.getElementById("frame") as HTMLDivElement;
  const stageHost = document.getElementById("stage-host") as HTMLDivElement;
  const uiRoot = document.getElementById("ui-root") as HTMLDivElement;

  scaleFrame(frame, content.config.canvas);
  window.addEventListener("resize", () => scaleFrame(frame, content.config.canvas));

  const defaultBrush = content.brushes[0] as BrushPreset;

  // --- Audio ----------------------------------------------------------------
  // Il motore esiste subito ma resta muto: il contesto audio si sblocca
  // solo al tap su "Inizia", che è l'unico gesto garantito del flusso.
  const audio = new AudioEngine(content.sound, content.config.audio.maxGain);
  const composer = new Composer(audio, content.sound);
  const byId = new Map(content.elements.map((e) => [e.id, e]));
  let paintVoice: PaintVoice;

  const canvas = new CanvasStage(
    stageHost,
    { ...content.config, canvasBackground: palette.canvasBackground },
    defaultBrush,
    ASSET_BASE,
    {
      onBegin: (id, x, y) => paintVoice?.begin(id, x, y),
      onMove: (id, x, y) => paintVoice?.move(id, x, y, currentSwatch()),
      onEnd: (id, _x, y) => paintVoice?.end(id, currentSwatch(), y),
    },
  );
  paintVoice = new PaintVoice(composer, content.sound, canvas.artboardRect);

  // Solo per il mouse: in sala non compare mai.
  new PointerHalo(
    // Diametro in pixel di schermo: la dimensione del pennello è espressa
    // nelle coordinate di progetto e va convertita, o il cerchio mente.
    () => (content.brushes.find((b) => b.id === store.state.brushId)?.size ?? 18) * 2 * canvas.displayScale,
    () => store.currentColor,
  );

  // Il sequencer legge le posizioni CORRENTI dei nodi a ogni sedicesimo:
  // trascinare una forma mentre suona cambia la musica senza notifiche.
  const playhead = new Playhead(content.config);
  const sequencer = new Sequencer(
    content.sound,
    () =>
      canvas.elements.snapshot().map((p) => ({ ...p, swatch: currentSwatchFor(p.def.id) })),
    (event) => {
      composer.trigger(event);
      canvas.elements.pulse(event.nodeId);
      playhead.flash(event.x, event.swatch.hex);
    },
    undefined,
    (time) => {
      composer.tickHarmony(time);
      // La tinta della traccia segue l'accordo, usando i colori della
      // tavolozza in uso: l'informazione resta dentro il linguaggio dell'opera.
      const i = composer.harmony.chordIndex % palette.swatches.length;
      playhead.setChordTint(palette.swatches[i].hex);
    },
  );
  playhead.bind(() => sequencer.position);
  await canvas.elements.preload(content.elements);

  canvas.paint.setColor(store.currentColor);

  function currentSwatch() {
    return palette.swatches.find((s) => s.id === store.state.colorId)!;
  }

  /**
   * Colore con cui la forma è stata posata. Il timbro resta quello scelto
   * al momento del drop: cambiare tavolozza a metà opera non deve ricolorare
   * retroattivamente il suono di ciò che è già sulla tela.
   */
  const swatchByNode = new Map<string, string>();
  function currentSwatchFor(elementId: string) {
    const id = swatchByNode.get(elementId) ?? store.state.colorId;
    return palette.swatches.find((s) => s.id === id) ?? currentSwatch();
  }

  function refreshPlayheadMarks() {
    playhead.setMarks(
      canvas.elements.snapshot().map((p) => ({
        x: p.x,
        color: currentSwatchFor(p.def.id).hex,
      })),
    );
  }

  const didactics = new DidacticEngine(content.didactics, (card) => showDidacticCard(uiRoot, card));

  // --- Idle -----------------------------------------------------------------
  let dismissIdle: (() => void) | null = null;
  const idle = new IdleWatcher(
    content.config.idle.warningAfterSec,
    content.config.idle.resetAfterSec,
    (secondsLeft) => {
      if (dismissIdle) return;
      dismissIdle = screens.idleWarning(uiRoot, secondsLeft, () => idle.touch());
    },
    () => restart(),
    () => {
      dismissIdle?.();
      dismissIdle = null;
    },
  );

  // --- Studio ---------------------------------------------------------------
  let studioChrome: HTMLElement[] = [];

  function buildStudio() {
    const left = renderToolPanel(
      uiRoot,
      palette,
      content.brushes,
      (swatch) => {
        store.state.colorId = swatch.id;
        canvas.paint.setColor(swatch.hex);
        didactics.onColorPicked(swatch.id);
        // Anteprima del timbro: il bambino sente il colore prima di usarlo.
        composer.previewColor(swatch);
      },
      (brush) => {
        store.state.brushId = brush.id;
        canvas.paint.setBrush(brush);
      },
    );

    // Le forme vivono nella stessa colonna dei colori e dei pennelli.
    const right = renderElementTray(left, content.elements, content.sets, ASSET_BASE, (def, x, y) => {
      const node = canvas.dropElement(def, x, y, currentTintFor(def));
      if (node) {
        store.state.stats.placementCount = canvas.elements.count;
        didactics.onElementPlaced(def, canvas.elements.count);
        swatchByNode.set(def.id, store.state.colorId);
        composer.addElement(def, currentSwatch());
        refreshPlayheadMarks();
      }
    });

    const top = document.createElement("header");
    top.className = "topbar";
    // La barra superiore ospita solo il logotipo e la linea temporale:
    // qualunque altro elemento finisce sopra la traccia, che è larga quanto
    // la tela e non può essere accorciata senza rompere la corrispondenza
    // verticale con le forme.
    top.innerHTML = `
      <div class="brand">
        <div class="wordmark">Kandinsky<span>Lab</span></div>
        <div class="brand__studio">
          <img src="${ASSET_BASE}/ui/kansei-logo.svg" alt="" />
          <span>Kansei Studio</span>
        </div>
      </div>
      <button class="btn-info" id="info" aria-label="Come funziona la linea in alto">?</button>
    `;
    // La testina vive nella barra superiore, allineata all'ampiezza della tela.
    top.append(playhead.element);
    top.querySelector<HTMLButtonElement>("#info")!.onclick = () => showInfoDialog(uiRoot);
    refreshPlayheadMarks();

    const bottom = document.createElement("footer");
    bottom.className = "bottombar";
    bottom.innerHTML = `
      <div></div>
      <div class="bottombar__tools">
        <button class="btn" id="undo">Annulla</button>
        <button class="btn" id="duplicate">Duplica</button>
        <button class="btn btn--danger" id="delete">Togli forma</button>
        <button class="btn btn--danger" id="clear">Ricomincia</button>
      </div>
      <button class="btn btn--primary btn--finish" id="finish">Ho finito</button>
    `;

    uiRoot.append(top, bottom);
    studioChrome = [left, top, bottom];
    void right;

    bottom.querySelector<HTMLButtonElement>("#finish")!.onclick = () => goToReview();
    bottom.querySelector<HTMLButtonElement>("#undo")!.onclick = () => {
      canvas.undo();
      store.state.stats.undoCount++;
    };
    bottom.querySelector<HTMLButtonElement>("#duplicate")!.onclick = () => canvas.elements.duplicateSelected();
    bottom.querySelector<HTMLButtonElement>("#delete")!.onclick = () => {
      const removed = canvas.elements.selectedElementId;
      canvas.elements.removeSelected();
      if (removed) composer.removeElement(removed);
      refreshPlayheadMarks();
    };
    bottom.querySelector<HTMLButtonElement>("#clear")!.onclick = () => {
      // Distruttivo: conferma esplicita. Un bambino tocca tutto.
      if (confirmClear()) {
        canvas.clearAll();
        composer.clear();
        audio.silence();
        audio.resume();
        sequencer.stop();
        sequencer.start();
        swatchByNode.clear();
        refreshPlayheadMarks();
        store.state.stats.clearCount++;
      }
    };
  }

  function teardownStudio() {
    studioChrome.forEach((el) => el.remove());
    studioChrome = [];
    dismissCard();
  }

  function currentTintFor(def: ElementDefinition) {
    return def.asset.tintable ? store.currentColor : null;
  }

  // --- Flusso ---------------------------------------------------------------
  let dismissScreen: (() => void) | null = null;

  function show(fn: () => () => void) {
    dismissScreen?.();
    dismissScreen = fn();
  }

  function goToWelcome() {
    store.setScreen("welcome");
    idle.stop();
    show(() =>
      screens.welcomeScreen(uiRoot, async () => {
        // Unico punto in cui il browser ci lascia far partire l'audio.
        if (content.config.audio.enabled && content.sound.enabled) {
          await audio.unlock(); // no-op se già sbloccato in una sessione precedente
          audio.resume();
          sequencer.start();
        }
        dismissScreen?.();
        dismissScreen = null;
        store.setScreen("studio");
        buildStudio();
        idle.start();
      }),
    );
  }

  function goToReview() {
    store.setScreen("review");
    didactics.onComplete();

    // La coda si compone da sola: ultimo passaggio della testina, ritiro degli
    // strati, risoluzione sulla tonica. L'opera resta a schermo per tutta la
    // sua durata, così il finale non viene tagliato da un tocco impaziente.
    const codaSec = composer.finale(sequencer.remainingInCycle());
    sequencer.stop();
    if (content.config.debug) console.log(`[audio] coda finale: ${codaSec.toFixed(1)}s`);

    const preview = exportPreview(canvas);
    show(() =>
      screens.reviewScreen(
        uiRoot,
        preview,
        () => goToTitle(),
        () => {
          // "Continua a dipingere": la musica riparte da dove si era fermata.
          dismissScreen?.();
          dismissScreen = null;
          audio.cancelFadeOut();
          sequencer.start();
          store.setScreen("studio");
        },
      ),
    );
  }

  function goToTitle() {
    store.setScreen("title");
    show(() =>
      screens.titleScreen(uiRoot, (title) => {
        store.state.title = title || "Senza titolo";
        const puoSpedire = content.config.email.enabled && content.config.server.enabled;
        puoSpedire ? goToEmail() : void deliver(undefined);
      }),
    );
  }

  function goToEmail() {
    store.setScreen("email");
    show(() =>
      screens.emailScreen(
        uiRoot,
        (email) => void deliver(email),
        () => void deliver(undefined),
      ),
    );
  }

  async function deliver(email?: string) {
    try {
      await deliverInner(email);
    } catch (err: any) {
      // Senza questo blocco un errore in export o invio lascia il bambino
      // fermo sulla schermata dell'e-mail, senza nulla che indichi cosa
      // sia successo. È il difetto che rende impossibile capire perché
      // "la mail non arriva".
      console.error("[deliver] consegna fallita:", err);
      store.setScreen("thanks");
      // La consegna è fallita: l'opera resta nell'outbox e riparte da sola.
      show(() => screens.thanksScreen(uiRoot, "queued", () => restart()));
    }
  }

  async function deliverInner(email?: string) {
    const artwork = await exportArtwork(canvas, content.config, {
      title: store.state.title,
      museumName: "Museo",
      date: new Date(),
      logoUrl: `${ASSET_BASE}/ui/museum-logo.png`,
      studioLogoUrl: `${ASSET_BASE}/ui/kansei-logo.png`,
    });

    const result = await submitArtwork({
      sessionId: store.state.sessionId,
      title: store.state.title,
      imageBase64: artwork.base64,
      placements: canvas.elements.serialize(),
      score: content.sound.enabled ? composer.serialize(byId) : undefined,
      stats: {
        durationMs: Date.now() - store.state.startedAt,
        strokeCount: canvas.paint.strokeCount,
        placementCount: canvas.elements.count,
        undoCount: store.state.stats.undoCount,
        clearCount: store.state.stats.clearCount,
        paletteId: palette.id,
        soundLayers: composer.layerCount,
        didacticCardsShown: store.state.stats.cardsShown,
        completed: true,
        emailRequested: Boolean(email),
      },
      email,
      consent: email
        ? { acceptedAt: new Date().toISOString(), version: content.config.email.consentVersion }
        : undefined,
      kioskId: content.config.kioskId,
      createdAt: new Date().toISOString(),
    });

    store.setScreen("thanks");
    show(() => screens.thanksScreen(uiRoot, result, () => restart()));
  }

  function restart() {
    dismissIdle?.();
    dismissIdle = null;
    teardownStudio();
    canvas.clearAll();

    // Il silenzio è totale e immediato: la musica di una sessione non deve
    // mai sopravvivere sulla schermata di benvenuto della successiva.
    sequencer.stop();
    composer.clear();
    audio.silence();

    swatchByNode.clear();
    didactics.reset();
    store.newSession();
    canvas.paint.setColor(store.currentColor);
    goToWelcome();
  }

  startOutboxWorker();
  goToWelcome();

  if (content.config.debug) {
    (window as any).__kandinsky = { canvas, store, content, restart, audio, composer, sequencer,
      get outboxError() { return lastOutboxError; } };
  }
}

/** Scala il layout 1920x1080 se il pannello ha una risoluzione diversa. */
function scaleFrame(frame: HTMLDivElement, canvas: { width: number; height: number }) {
  const s = Math.min(window.innerWidth / canvas.width, window.innerHeight / canvas.height);
  frame.style.transform = `scale(${s})`;
  frame.style.left = `${(window.innerWidth - canvas.width * s) / 2}px`;
  frame.style.top = `${(window.innerHeight - canvas.height * s) / 2}px`;
  frame.style.position = "absolute";
}

function confirmClear() {
  // TODO: sostituire con un dialogo a schermo intero, due pulsanti grandi.
  return window.confirm("Vuoi ricominciare da capo?");
}

boot().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<div style="color:#F7F3E8;font:20px system-ui;padding:80px">
    Kandinsky Lab non è riuscito a partire.<br/><br/>
    <code style="opacity:.7">${String(err)}</code>
  </div>`;
});
