const { app, BrowserWindow, globalShortcut, powerSaveBlocker, screen, shell } = require("electron");
const path = require("node:path");
const { accessSync, constants, mkdirSync, writeFileSync } = require("node:fs");
const { avviaServer } = require("./server.cjs");
const { caricaConfig, diagnosiSmtp } = require("./config.cjs");
const { Consegna } = require("./delivery.cjs");

/**
 * Guscio da chiosco.
 *
 * L'applicazione è autosufficiente: serve l'esperienza, riceve le opere,
 * le salva su disco e le spedisce. Nessun servizio esterno, nessuna rete
 * necessaria oltre a quella per la posta.
 *
 * Le cose che rompono davvero un'installazione museale, in ordine di frequenza:
 * 1. lo screensaver che parte a metà mattina    -> powerSaveBlocker
 * 2. un visitatore che apre il menu contestuale -> disabilitato
 * 3. Alt+F4 o Ctrl+W di un adulto curioso       -> intercettati
 * 4. il renderer che crasha alle 15:00          -> ricaricamento automatico
 */
// Il nome decide dove finisce la cartella dei dati. Senza, in sviluppo
// Electron usa il campo "name" del package.json — "@kandinsky/shell" — e
// crea una struttura annidata diversa da quella dell'applicazione installata:
// la configurazione che compili in prova non è quella che legge in sala.
app.setName("Kandinsky Lab");

let win = null;
let blockerId = null;
let server = null;
let consegna = null;

const USCITA = "CommandOrControl+Alt+Shift+Q";
const APRI_DATI = "CommandOrControl+Alt+Shift+D";

/**
 * Dove vivono configurazione, opere e coda.
 *
 * L'ordine è quello che rende la cartella copiabile su un'altra macchina
 * portandosi dietro tutto:
 *
 *   1. KANDINSKY_DATA_DIR, se impostata — è quello che fa il file di avvio
 *   2. accanto all'eseguibile, se la cartella è scrivibile — modalità portabile
 *   3. la cartella utente di sistema — installazione classica in Programmi,
 *      dove scrivere accanto all'eseguibile non è permesso
 *
 * Senza il punto 2, copiare la cartella su un altro computer lascerebbe
 * indietro la configurazione, e ci si ritroverebbe a ricompilarla ogni volta.
 */
function cartellaDati() {
  if (process.env.KANDINSKY_DATA_DIR) {
    return process.env.KANDINSKY_DATA_DIR;
  }

  // La versione portabile di electron-builder espone la cartella da cui
  // l'eseguibile è stato lanciato: quella vera, non quella temporanea in
  // cui si scompatta.
  const accanto = process.env.PORTABLE_EXECUTABLE_DIR
    ?? path.dirname(app.getPath("exe"));

  try {
    const candidata = path.join(accanto, "dati");
    mkdirSync(candidata, { recursive: true });
    accessSync(candidata, constants.W_OK);
    return candidata;
  } catch {
    // Installazione in Programmi: lì non si scrive, ed è giusto così.
    return app.getPath("userData");
  }
}

function cartelle() {
  if (app.isPackaged) {
    return {
      kioskDir: path.join(process.resourcesPath, "kiosk"),
      contentDir: path.join(process.resourcesPath, "content"),
    };
  }
  return {
    kioskDir: path.join(__dirname, "../kiosk/dist"),
    contentDir: path.join(__dirname, "../../packages/content"),
  };
}

async function creaFinestra() {
  const { kioskDir, contentDir } = cartelle();

  // I dati vivono fuori dall'applicazione: sopravvivono agli aggiornamenti
  // e restano raggiungibili senza aprire il pacchetto.
  const dataDir = cartellaDati();
  const { config, creata, errore, percorso } = caricaConfig(
    path.join(dataDir, "kandinsky.config.json"),
  );

  // Riepilogo esplicito all'avvio: è la prima cosa da guardare quando in sala
  // qualcuno dice "non arrivano le mail", e deve essere leggibile senza
  // conoscere il progetto.
  console.log("");
  console.log("  Kandinsky Lab");
  console.log(`  cartella dati   ${dataDir}`);
  console.log(`  configurazione  ${creata ? "creata ora, da compilare" : errore ? `ILLEGGIBILE: ${errore}` : "letta"}`);
  const problema = diagnosiSmtp(config.smtp);
  console.log(
    `  invio e-mail    ${
      problema
        ? `DISATTIVO — ${problema}`
        : `attivo via ${config.smtp.host}:${config.smtp.port} come ${config.smtp.user}`
    }`,
  );
  if (problema) {
    console.log(`  file letto      ${percorso}`);
  }
  console.log("");

  consegna = new Consegna({ dataDir, config });
  consegna.avvia();

  const avviato = await avviaServer({ kioskDir, contentDir, consegna });
  server = avviato.server;
  console.log(`[shell] esperienza su ${avviato.url}`);

  const display = screen.getPrimaryDisplay();
  const intero = config.kiosk.schermoIntero !== false;

  win = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: intero ? display.bounds.width : 1600,
    height: intero ? display.bounds.height : 900,
    fullscreen: intero,
    kiosk: intero,
    frame: !intero,
    backgroundColor: "#141414",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  win.loadURL(process.env.KIOSK_URL || avviato.url);
  win.webContents.on("context-menu", (e) => e.preventDefault());
  win.webContents.on("render-process-gone", (_e, dettagli) => {
    console.error(`[shell] renderer terminato: ${dettagli.reason}`);
    win.reload();
  });
  win.on("closed", () => (win = null));
}

app.commandLine.appendSwitch("touch-events", "enabled");
app.commandLine.appendSwitch("disable-pinch");
app.commandLine.appendSwitch("overscroll-history-navigation", "0");

app.whenReady().then(async () => {
  blockerId = powerSaveBlocker.start("prevent-display-sleep");
  await creaFinestra();

  globalShortcut.register(USCITA, () => {
    // Segnale al file di avvio: questa è un'uscita voluta, non un guasto.
    // Senza, il rilancio automatico riaprirebbe l'applicazione e non ci
    // sarebbe modo di chiuderla davvero.
    try {
      writeFileSync(path.join(cartellaDati(), ".uscita-richiesta"), new Date().toISOString());
    } catch {
      // Se non si può scrivere, si esce comunque: chiudere ha la precedenza.
    }
    app.quit();
  });

  // Scorciatoia per il personale: apre la cartella con configurazione,
  // opere salvate e coda. Serve a chi deve intervenire senza sapere dove
  // guardare, e non si trova per caso.
  globalShortcut.register(APRI_DATI, () => shell.openPath(cartellaDati()));
  ["CommandOrControl+W", "CommandOrControl+R", "F11"].forEach((k) =>
    globalShortcut.register(k, () => {}),
  );

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void creaFinestra();
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  if (blockerId !== null) powerSaveBlocker.stop(blockerId);
  consegna?.ferma();
  server?.close();
});

app.on("window-all-closed", () => app.quit());
