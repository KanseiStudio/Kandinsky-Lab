const { createReadStream, existsSync, statSync } = require("node:fs");
const { createServer } = require("node:http");
const { extname, join, normalize, resolve } = require("node:path");

/**
 * Server statico interno all'applicazione.
 *
 * Perché non caricare i file con `file://`: i moduli ES e le richieste fetch
 * verso /content sono soggetti alle regole di origine, e con il protocollo
 * file:// falliscono entrambe. Servire da 127.0.0.1 risolve tutto e non
 * apre nulla verso l'esterno.
 *
 * Ascolta solo sull'interfaccia di loopback su una porta assegnata dal
 * sistema: nessun altro dispositivo della rete del museo può raggiungerlo.
 */
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".map": "application/json",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

function servi(radice, richiesta, risposta, prefisso = "") {
  const percorso = decodeURIComponent((richiesta.url ?? "/").split("?")[0]);
  const relativo = prefisso ? percorso.slice(prefisso.length) : percorso;
  const file = resolve(radice, `.${normalize(relativo)}`);

  // Blocca l'uscita dalla cartella servita.
  if (!file.startsWith(radice)) {
    risposta.writeHead(403).end();
    return true;
  }
  if (!existsSync(file) || !statSync(file).isFile()) return false;

  risposta.writeHead(200, {
    "Content-Type": MIME[extname(file).toLowerCase()] ?? "application/octet-stream",
    "Cache-Control": "no-store",
  });
  createReadStream(file).pipe(risposta);
  return true;
}

/** Avvia il server e restituisce l'indirizzo da caricare nella finestra. */
function avviaServer({ kioskDir, contentDir }) {
  return new Promise((risolvi, rifiuta) => {
    const server = createServer((req, res) => {
      if (req.url?.startsWith("/content/")) {
        if (servi(contentDir, req, res, "/content")) return;
      }
      if (servi(kioskDir, req, res)) return;

      // Qualunque altro percorso ricade sull'applicazione.
      const indice = join(kioskDir, "index.html");
      if (existsSync(indice)) {
        res.writeHead(200, { "Content-Type": MIME[".html"] });
        createReadStream(indice).pipe(res);
        return;
      }
      res.writeHead(404).end("Applicazione non compilata.");
    });

    server.on("error", rifiuta);
    // Porta 0: la sceglie il sistema fra quelle libere, così due postazioni
    // sulla stessa macchina non si contendono la stessa.
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      risolvi({ url: `http://127.0.0.1:${port}`, server });
    });
  });
}

module.exports = { avviaServer };
