const { createReadStream, existsSync, statSync } = require("node:fs");
const { createServer } = require("node:http");
const { extname, join, normalize, resolve } = require("node:path");

/**
 * Server interno all'applicazione.
 *
 * Fa due cose: serve l'esperienza e riceve le opere. Espone la stessa
 * interfaccia HTTP del server web, così il codice del frontend è identico
 * nelle due situazioni — nessun ramo "se sono nell'app desktop".
 *
 * Perché non caricare i file con `file://`: i moduli ES e le richieste verso
 * /content sono soggetti alle regole di origine, e con quel protocollo
 * falliscono entrambi. Il server ascolta solo su 127.0.0.1 con una porta
 * assegnata dal sistema: nessun dispositivo della rete del museo lo raggiunge.
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
};

const LIMITE_CORPO = 64 * 1024 * 1024; // i PNG ad alta risoluzione in base64

function serviFile(radice, url, res, prefisso = "") {
  const percorso = decodeURIComponent(url.split("?")[0]);
  const relativo = prefisso ? percorso.slice(prefisso.length) : percorso;
  const file = resolve(radice, `.${normalize(relativo)}`);

  if (!file.startsWith(radice)) {
    res.writeHead(403).end();
    return true;
  }
  if (!existsSync(file) || !statSync(file).isFile()) return false;

  res.writeHead(200, {
    "Content-Type": MIME[extname(file).toLowerCase()] ?? "application/octet-stream",
    "Cache-Control": "no-store",
  });
  createReadStream(file).pipe(res);
  return true;
}

function leggiCorpo(req) {
  return new Promise((risolvi, rifiuta) => {
    const pezzi = [];
    let dimensione = 0;
    req.on("data", (c) => {
      dimensione += c.length;
      if (dimensione > LIMITE_CORPO) {
        rifiuta(new Error("corpo troppo grande"));
        req.destroy();
        return;
      }
      pezzi.push(c);
    });
    req.on("end", () => {
      try {
        risolvi(JSON.parse(Buffer.concat(pezzi).toString("utf8")));
      } catch (err) {
        rifiuta(err);
      }
    });
    req.on("error", rifiuta);
  });
}

function json(res, codice, dati) {
  res.writeHead(codice, { "Content-Type": MIME[".json"] });
  res.end(JSON.stringify(dati));
}

function avviaServer({ kioskDir, contentDir, consegna, log = console }) {
  return new Promise((risolvi, rifiuta) => {
    const server = createServer(async (req, res) => {
      const url = req.url ?? "/";

      // --- API -------------------------------------------------------------
      if (url === "/api/artworks" && req.method === "POST") {
        try {
          const opera = await leggiCorpo(req);
          if (!opera?.sessionId || !opera?.imageBase64) {
            return json(res, 400, { error: "payload incompleto" });
          }
          const esito = consegna.accoda(opera);
          return json(res, 202, { ok: true, sessionId: opera.sessionId, ...esito });
        } catch (err) {
          log.error(`[api] salvataggio fallito: ${err.message}`);
          return json(res, 500, { error: String(err.message).slice(0, 200) });
        }
      }

      if (url === "/api/health") return json(res, 200, { ok: true, ...consegna.stato() });
      if (url === "/api/queue") return json(res, 200, consegna.stato());

      // --- File statici ----------------------------------------------------
      if (url.startsWith("/content/") && serviFile(contentDir, url, res, "/content")) return;
      if (serviFile(kioskDir, url, res)) return;

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
    // sulla stessa macchina non se la contendono.
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      risolvi({ url: `http://127.0.0.1:${port}`, server, port });
    });
  });
}

module.exports = { avviaServer };
