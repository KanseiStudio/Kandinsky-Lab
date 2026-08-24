import express from "express";
import cors from "cors";
import { existsSync } from "node:fs";
import { basicAuth } from "./auth";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ArtworkSubmission } from "@kandinsky/schema";
import { openDb } from "./db";
import { createMailer } from "./mailer";
import { startQueueWorker } from "./queue";
import { startRetentionJob } from "./retention";

const PORT = Number(process.env.PORT ?? 8787);
const DATA_DIR = process.env.DATA_DIR ?? "./data";
const IMAGE_DIR = join(DATA_DIR, "artworks");

const db = openDb(join(DATA_DIR, "kandinsky.db"));

const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);

const mailer = createMailer({
  host: process.env.SMTP_HOST ?? "localhost",
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === "true",
  user: process.env.SMTP_USER ?? "",
  pass: process.env.SMTP_PASS ?? "",
  from: process.env.MAIL_FROM ?? "Kandinsky Lab <noreply@example.org>",
  museumName: process.env.MUSEUM_NAME ?? "Museo",
  museumUrl: process.env.MUSEUM_URL ?? "https://example.org",
});

const app = express();

// Dietro il proxy di un servizio di hosting: senza, il server crede che
// tutte le richieste arrivino da localhost e i log sono inutilizzabili.
app.set("trust proxy", 1);

app.use(cors({ origin: true }));

/**
 * Protezione con password.
 *
 * Attiva solo se APP_PASSWORD è valorizzata: in sviluppo si lascia vuota e
 * non dà fastidio, in sala il chiosco gira in locale e non serve. Esiste
 * per la fase di prova su indirizzo pubblico.
 */
const APP_PASSWORD = process.env.APP_PASSWORD ?? "";
if (APP_PASSWORD) {
  app.use(basicAuth(process.env.APP_USER ?? "kandinsky", APP_PASSWORD));
  console.log("[server] accesso protetto da password");
} else {
  console.warn("[server] APP_PASSWORD non impostata: l'applicazione è pubblica.");
}
// I PNG full-res arrivano in base64, che gonfia del 33%. A pixelRatio 3 una
// tela 1240x816 diventa 3720x2448: con molte campiture piene si superano
// tranquillamente i 24 MB, e il 413 che ne risulta è silenzioso lato chiosco.
app.use(express.json({ limit: "64mb" }));

app.use((req, _res, next) => {
  if (req.method === "POST") {
    const kb = Number(req.headers["content-length"] ?? 0) / 1024;
    console.log(`[api] ${req.method} ${req.path} — ${kb.toFixed(0)} KB`);
  }
  next();
});

const insert = db.prepare(`
  INSERT OR IGNORE INTO artworks
    (session_id, title, image_path, placements, score, stats, kiosk_id, created_at, email, consent_at, consent_ver, status)
  VALUES
    (@session_id, @title, @image_path, @placements, @score, @stats, @kiosk_id, @created_at, @email, @consent_at, @consent_ver, @status)
`);

app.post("/api/artworks", async (req, res) => {
  const parsed = ArtworkSubmission.safeParse(req.body);
  if (!parsed.success) {
    console.warn("[api] payload rifiutato:", JSON.stringify(parsed.error.issues).slice(0, 400));
    return res.status(400).json({ error: "payload non valido", issues: parsed.error.issues });
  }
  const a = parsed.data;
  console.log(
    `[api] opera ${a.sessionId} — titolo "${a.title}", ` +
      `e-mail ${a.email ? "presente" : "assente"}, ${a.placements.length} forme`,
  );

  try {
    await mkdir(IMAGE_DIR, { recursive: true });
    const filename = `${a.createdAt.slice(0, 10)}_${a.sessionId}.png`;
    const imagePath = join(IMAGE_DIR, filename);
    await writeFile(imagePath, Buffer.from(a.imageBase64, "base64"));

    insert.run({
      session_id: a.sessionId,
      title: sanitizeTitle(a.title),
      image_path: imagePath,
      placements: JSON.stringify(a.placements),
      score: a.score ? JSON.stringify(a.score) : null,
      stats: JSON.stringify(a.stats ?? {}),
      kiosk_id: a.kioskId,
      created_at: a.createdAt,
      email: a.email ?? null,
      consent_at: a.consent?.acceptedAt ?? null,
      consent_ver: a.consent?.version ?? null,
      // Senza e-mail l'opera è archiviata e basta: niente da spedire.
      status: a.email ? "queued" : "sent",
    });

    console.log(`[api] salvata ${a.sessionId} -> ${a.email ? "in coda per l'invio" : "solo archivio"}`);
    res.status(202).json({ ok: true, sessionId: a.sessionId, queued: Boolean(a.email) });
  } catch (err: any) {
    console.error("[api] errore salvataggio", err);
    res.status(500).json({ error: "salvataggio fallito" });
  }
});

/**
 * Riascolto pubblico dell'opera.
 *
 * L'e-mail non allega audio: allega l'immagine e linka questa risorsa.
 * La partitura è un JSON di pochi KB che il browser del genitore
 * ricostruisce con lo stesso motore usato in sala. Nessun file audio
 * da generare, archiviare o spedire.
 *
 * Nota: l'endpoint restituisce solo dati anonimi (titolo, partitura,
 * disposizione). Nessun indirizzo, nessun riferimento a persone.
 */
app.get("/api/artworks/:sessionId/score", (req, res) => {
  const row = db
    .prepare(`SELECT title, score, placements, created_at FROM artworks WHERE session_id = ? AND status != 'purged'`)
    .get(req.params.sessionId) as any;
  if (!row) return res.status(404).json({ error: "non trovata" });
  res.json({
    title: row.title,
    createdAt: row.created_at,
    score: row.score ? JSON.parse(row.score) : null,
    placements: row.placements ? JSON.parse(row.placements) : [],
  });
});

/**
 * Diagnostica della coda. Mostra l'ultimo errore per ogni opera non partita:
 * è il modo più rapido per sapere se il problema è SMTP, indirizzo o rete.
 * Non espone gli indirizzi in chiaro.
 */
app.get("/api/queue", (_req, res) => {
  const rows = db
    .prepare(`
      SELECT session_id, status, attempts, last_error, next_attempt_at, created_at,
             CASE WHEN email IS NULL THEN 0 ELSE 1 END AS has_email
      FROM artworks
      WHERE status != 'sent'
      ORDER BY created_at DESC
      LIMIT 50
    `)
    .all() as unknown as any[];
  res.json({ pending: rows.length, items: rows });
});

/** Stato di sala per il monitoraggio: quante opere, quante in coda, quante fallite. */
app.get("/api/health", (_req, res) => {
  const counts = db
    .prepare(`SELECT status, COUNT(*) as n FROM artworks GROUP BY status`)
    .all() as unknown as { status: string; n: number }[];
  const today = db
    .prepare(`SELECT COUNT(*) as n FROM artworks WHERE date(created_at) = date('now')`)
    .get() as unknown as { n: number };
  res.json({ ok: true, today: today.n, byStatus: Object.fromEntries(counts.map((c) => [c.status, c.n])) });
});

/**
 * Cancellazione su richiesta dell'interessato (art. 17 GDPR).
 * Il genitore che scrive al museo deve poter far sparire tutto.
 */
app.delete("/api/artworks/:sessionId", (req, res) => {
  const info = db
    .prepare(`UPDATE artworks SET email=NULL, status='purged', purged_at=datetime('now') WHERE session_id=?`)
    .run(req.params.sessionId);
  res.json({ ok: true, updated: Number(info.changes) });
});

function sanitizeTitle(raw: string) {
  const cleaned = raw.replace(/[<>{}$]/g, "").trim().slice(0, 60);
  // TODO: filtro parolacce IT/EN prima della messa in sala.
  return cleaned || "Senza titolo";
}

/**
 * Distribuzione dei file statici.
 *
 * In produzione il server serve anche l'esperienza: un solo processo, un solo
 * dominio, una sola password che copre tutto. I contenuti restano una cartella
 * separata e sostituibile senza ricompilare, come in sviluppo.
 */
// Risolti rispetto alla radice del progetto, non alla cartella di esecuzione:
// `node dist/index.js` e `tsx src/index.ts` partono da posti diversi.
const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");
const KIOSK_DIR = process.env.KIOSK_DIR ?? resolve(ROOT, "apps/kiosk/dist");
const CONTENT_DIR = process.env.CONTENT_DIR ?? resolve(ROOT, "packages/content");

if (existsSync(KIOSK_DIR)) {
  app.use("/content", express.static(CONTENT_DIR, { maxAge: 0 }));
  app.use(express.static(KIOSK_DIR, { maxAge: "1h", index: "index.html" }));
  console.log(`[server] esperienza servita da ${KIOSK_DIR}`);
} else {
  console.warn(`[server] ${KIOSK_DIR} non trovata: eseguire prima "pnpm build".`);
}

// Gestore d'errore finale: senza, un payload troppo grande produce una
// risposta HTML che il chiosco non sa interpretare.
app.use((err: any, _req: any, res: any, _next: any) => {
  const tooLarge = err?.type === "entity.too.large";
  console.error(`[api] errore: ${err?.message}`);
  res.status(tooLarge ? 413 : 500).json({
    error: tooLarge ? "immagine troppo grande" : "errore interno",
    detail: String(err?.message ?? "").slice(0, 200),
  });
});

app.listen(PORT, () => {
  console.log(`[server] Kandinsky Lab in ascolto su :${PORT}`);

  if (!smtpConfigured) {
    // In sviluppo è la condizione normale. Le opere vengono comunque
    // salvate su disco e accodate: si riprendono quando l'SMTP arriva.
    console.warn("[server] SMTP non configurato: le opere restano in coda, nessun invio.");
  } else {
    mailer.verify().then(
      () => console.log("[server] SMTP verificato"),
      (e) => console.warn("[server] SMTP non raggiungibile:", e.message),
    );
    startQueueWorker(db, mailer, process.env.LISTEN_BASE_URL);
  }
  startRetentionJob(db, {
    purgeEmailAfterMinutes: Number(process.env.PURGE_EMAIL_AFTER_MIN ?? 60),
    purgeImagesAfterDays: Number(process.env.PURGE_IMAGES_AFTER_DAYS ?? 30),
  });
});

void randomUUID;
