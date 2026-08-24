import { defineConfig, type Plugin } from "vite";
import { createReadStream, cpSync, existsSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Il pacchetto è ESM ("type": "module"), quindi __dirname non esiste.
const here = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = resolve(here, "../../packages/content");

const MIME: Record<string, string> = {
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

/**
 * Serve `packages/content` sotto /content senza copiarlo nel bundle.
 *
 * È la traduzione operativa dell'invariante numero 1: i contenuti restano
 * un artefatto separato, che il museo può modificare senza ricompilare.
 * In sviluppo li serviamo dal disco; in build li copiamo accanto all'output,
 * dove restano sostituibili a mano.
 *
 * Il symlink funzionerebbe su Linux e macOS, ma su Windows richiede
 * privilegi da amministratore o la modalità sviluppatore. Un middleware
 * di dieci righe evita a tutti quel problema.
 */
function contentPlugin(): Plugin {
  return {
    name: "kandinsky-content",

    configureServer(server) {
      server.middlewares.use("/content", (req, res, next) => {
        const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
        const file = resolve(CONTENT_DIR, `.${path}`);

        // Blocca i path traversal: /content/../../etc/passwd non deve uscire.
        if (!file.startsWith(CONTENT_DIR) || !existsSync(file) || !statSync(file).isFile()) {
          return next();
        }

        res.setHeader("Content-Type", MIME[extname(file).toLowerCase()] ?? "application/octet-stream");
        res.setHeader("Cache-Control", "no-store");
        createReadStream(file).pipe(res);
      });
    },

    closeBundle() {
      cpSync(CONTENT_DIR, resolve(here, "dist/content"), { recursive: true });
      console.log("[content] copiato in dist/content");
    },
  };
}

export default defineConfig({
  plugins: [contentPlugin()],
  server: {
    port: 5180,
    host: true,
  },
  resolve: {
    alias: {
      "@kandinsky/schema": resolve(here, "../../packages/schema/src/index.ts"),
    },
  },
  build: {
    target: "chrome120",
    assetsInlineLimit: 0,
    // Le mappe pesano più del bundle e vengono trasferite a ogni rilascio.
    // In locale restano, così `pnpm dev` e `pnpm app:dev` sono debuggabili.
    sourcemap: process.env.CI ? false : true,
    rollupOptions: {
      output: {
        // Tone e Konva pesano quanto tutto il resto e non cambiano mai:
        // separandoli, una correzione al codice non invalida la loro cache.
        manualChunks: {
          audio: ["tone"],
          canvas: ["konva"],
        },
      },
    },
  },
});
