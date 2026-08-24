const { app, BrowserWindow, globalShortcut, powerSaveBlocker, screen } = require("electron");
const path = require("node:path");

/**
 * Guscio da chiosco per il tavolo touch.
 *
 * Le cose che rompono davvero un'installazione museale, in ordine di frequenza:
 * 1. lo screensaver che parte a metà mattina  -> powerSaveBlocker
 * 2. un visitatore che apre il menu contestuale -> disabilitato
 * 3. Alt+F4 / Ctrl+W di un adulto curioso     -> intercettati
 * 4. il renderer che crasha alle 15:00        -> auto-reload
 */
let win = null;
let blockerId = null;

const KIOSK_URL = process.env.KIOSK_URL || `file://${path.join(__dirname, "dist/index.html")}`;
const EXIT_COMBO = "CommandOrControl+Alt+Shift+Q"; // uscita per il tecnico

function createWindow() {
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
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      // Il pannello riporta tocchi grezzi: senza questo Chrome
      // applica il proprio riconoscimento gesti e mangia il pinch.
      enableBlinkFeatures: "TouchEventFeatureDetection",
    },
  });

  win.loadURL(KIOSK_URL);
  win.webContents.on("context-menu", (e) => e.preventDefault());

  // Renderer morto: si riparte da soli, senza chiamare nessuno.
  win.webContents.on("render-process-gone", (_e, details) => {
    console.error("[shell] renderer terminato:", details.reason);
    win.reload();
  });

  win.on("closed", () => (win = null));
}

app.commandLine.appendSwitch("touch-events", "enabled");
app.commandLine.appendSwitch("disable-pinch");
app.commandLine.appendSwitch("overscroll-history-navigation", "0");
app.disableHardwareAcceleration = false;

app.whenReady().then(() => {
  blockerId = powerSaveBlocker.start("prevent-display-sleep");
  createWindow();

  globalShortcut.register(EXIT_COMBO, () => app.quit());
  ["CommandOrControl+W", "CommandOrControl+R", "F11", "Alt+F4"].forEach((k) =>
    globalShortcut.register(k, () => {}),
  );
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  if (blockerId !== null) powerSaveBlocker.stop(blockerId);
});

app.on("window-all-closed", () => app.quit());
