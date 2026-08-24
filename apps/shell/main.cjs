const { app, BrowserWindow, globalShortcut, powerSaveBlocker, screen } = require("electron");
const path = require("node:path");
const { avviaServer } = require("./server.cjs");

/**
 * Guscio da chiosco.
 *
 * Le cose che rompono davvero un'installazione museale, in ordine di frequenza:
 * 1. lo screensaver che parte a metà mattina   -> powerSaveBlocker
 * 2. un visitatore che apre il menu contestuale -> disabilitato
 * 3. Alt+F4 / Cmd+Q di un adulto curioso        -> intercettati
 * 4. il renderer che crasha alle 15:00          -> ricaricamento automatico
 *
 * L'esperienza viene servita da un server interno su 127.0.0.1 anziché
 * caricata con file://, perché i moduli ES e le richieste verso /content
 * con quel protocollo falliscono per via delle regole di origine.
 */
let win = null;
let blockerId = null;
let server = null;

const USCITA = "CommandOrControl+Alt+Shift+Q"; // combinazione per il tecnico

function cartelle() {
  // Nell'applicazione impacchettata i file stanno fra le risorse;
  // in sviluppo si leggono direttamente dal progetto.
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
  const avviato = await avviaServer({ kioskDir, contentDir });
  server = avviato.server;

  const display = screen.getPrimaryDisplay();

  win = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    fullscreen: true,
    kiosk: true,
    frame: false,
    backgroundColor: "#141414",
    autoHideMenuBar: true,
    // Su macOS nasconde i semafori mantenendo la finestra ridimensionabile
    // durante lo sviluppo.
    titleBarStyle: "hiddenInset",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  win.loadURL(process.env.KIOSK_URL || avviato.url);
  win.webContents.on("context-menu", (e) => e.preventDefault());

  win.webContents.on("render-process-gone", (_e, dettagli) => {
    console.error("[shell] renderer terminato:", dettagli.reason);
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

  globalShortcut.register(USCITA, () => app.quit());
  ["CommandOrControl+W", "CommandOrControl+R", "F11"].forEach((k) =>
    globalShortcut.register(k, () => {}),
  );

  // Convenzione macOS: cliccando l'icona nel Dock la finestra torna.
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void creaFinestra();
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  if (blockerId !== null) powerSaveBlocker.stop(blockerId);
  server?.close();
});

// Su macOS le applicazioni restano attive senza finestre: qui no, è un chiosco.
app.on("window-all-closed", () => app.quit());
