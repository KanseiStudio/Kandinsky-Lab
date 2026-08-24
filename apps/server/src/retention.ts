import type { Db } from "./db";

/**
 * Cancellazione automatica dei dati personali.
 *
 * Principio: l'e-mail serve a spedire un disegno, non a costruire una lista.
 * Appena l'invio è confermato l'indirizzo sparisce dal database.
 * Le immagini restano (senza collegamento a persone) solo se il museo
 * le vuole per la rendicontazione, e comunque a scadenza.
 *
 * Da allineare con l'informativa privacy consegnata al titolare del trattamento.
 */
export function startRetentionJob(
  db: Db,
  opts: { purgeEmailAfterMinutes: number; purgeImagesAfterDays: number },
) {
  const purgeEmails = db.prepare(`
    UPDATE artworks
    SET email = NULL, purged_at = datetime('now')
    WHERE email IS NOT NULL
      AND status = 'sent'
      AND sent_at <= datetime('now', ?)
  `);

  // Anche le opere mai spedite (max tentativi esauriti) perdono l'indirizzo.
  const purgeDeadLetters = db.prepare(`
    UPDATE artworks
    SET email = NULL, status = 'purged', purged_at = datetime('now')
    WHERE email IS NOT NULL
      AND status = 'failed'
      AND attempts >= 6
      AND created_at <= datetime('now', '-2 days')
  `);

  const purgeImages = db.prepare(`
    SELECT session_id, image_path FROM artworks
    WHERE image_path != '' AND created_at <= datetime('now', ?)
  `);

  function run() {
    // node:sqlite dichiara `changes` come number | bigint: su tabelle enormi
    // il conteggio può superare il numero sicuro. Qui sono decine di righe,
    // quindi la conversione è innocua, ma va fatta esplicitamente.
    const cancellati = Number(purgeEmails.run(`-${opts.purgeEmailAfterMinutes} minutes`).changes)
      + Number(purgeDeadLetters.run().changes);
    if (cancellati > 0) {
      console.log(`[retention] indirizzi cancellati: ${cancellati}`);
    }
    // La rimozione dei file su disco va fatta qui, con unlink sui path
    // restituiti da purgeImages, dopo aver aggiornato image_path a ''.
    void purgeImages;
  }

  setInterval(run, 15 * 60 * 1000);
  run();
}
