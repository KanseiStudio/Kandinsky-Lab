import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * SQLite locale come coda di consegna.
 *
 * Usiamo `node:sqlite`, il modulo integrato in Node (stabile da Node 24),
 * invece di better-sqlite3. Motivo pratico, non estetico: better-sqlite3 è
 * un modulo nativo e va compilato quando non esistono binari precompilati
 * per la versione di Node in uso. Su una macchina Windows senza toolchain
 * C++ l'installazione fallisce, e il mini-PC di un museo è esattamente una
 * macchina senza toolchain C++.
 *
 * Il PNG NON entra nel database: sta su disco, il DB tiene solo il path.
 * Un file da 4 MB per opera moltiplicato per 300 visite al giorno rende
 * inutilizzabile qualsiasi SQLite entro una settimana.
 */
export function openDb(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);

  // WAL: letture e scritture non si bloccano a vicenda. Serve perché il
  // worker della coda scrive mentre l'API sta ancora ricevendo opere.
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 5000;");

  db.exec(`
    CREATE TABLE IF NOT EXISTS artworks (
      session_id   TEXT PRIMARY KEY,
      title        TEXT NOT NULL,
      image_path   TEXT NOT NULL,
      placements   TEXT,
      -- Partitura della firma sonora. Testo, non audio: qualche KB.
      score        TEXT,
      stats        TEXT,
      kiosk_id     TEXT NOT NULL,
      created_at   TEXT NOT NULL,

      -- Dati personali, isolati e cancellabili in una sola UPDATE
      email        TEXT,
      consent_at   TEXT,
      consent_ver  TEXT,

      status       TEXT NOT NULL DEFAULT 'queued',
      attempts     INTEGER NOT NULL DEFAULT 0,
      last_error   TEXT,
      -- Momento del prossimo tentativo. Scritto esplicitamente invece di
      -- essere ricalcolato: così la coda è ispezionabile con una query.
      next_attempt_at TEXT,
      sent_at      TEXT,
      purged_at    TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_status ON artworks(status, attempts);
    CREATE INDEX IF NOT EXISTS idx_created ON artworks(created_at);
  `);

  // Migrazione per i database creati prima dell'introduzione della colonna.
  const columns = (db.prepare("PRAGMA table_info(artworks)").all() as unknown as { name: string }[])
    .map((c) => c.name);
  if (!columns.includes("next_attempt_at")) {
    db.exec("ALTER TABLE artworks ADD COLUMN next_attempt_at TEXT;");
  }
  if (!columns.includes("score")) {
    db.exec("ALTER TABLE artworks ADD COLUMN score TEXT;");
  }

  return db;
}

export type Db = DatabaseSync;
