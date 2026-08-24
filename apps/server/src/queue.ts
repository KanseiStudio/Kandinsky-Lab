import type { Db } from "./db";
import type { createMailer } from "./mailer";

const MAX_ATTEMPTS = 6;
/** backoff progressivo in minuti: 1, 5, 15, 60, 240, 720 */
const BACKOFF_MIN = [1, 5, 15, 60, 240, 720];

/**
 * Worker di consegna.
 *
 * Gira in-process: per 200-400 opere al giorno non serve Redis, e un chiosco
 * museale deve poter funzionare con un solo processo Node su un mini-PC
 * senza dipendenze esterne che qualcuno debba riavviare.
 */
export function startQueueWorker(
  db: Db,
  mailer: ReturnType<typeof createMailer>,
  listenBaseUrl?: string,
  intervalMs = 20_000,
) {
  /**
   * Recupero delle righe bloccate in 'sending'.
   *
   * Se il processo muore mentre sta spedendo — e in sviluppo muore a ogni
   * salvataggio, perché tsx riavvia — la riga resta in 'sending' e nessuna
   * query la ripesca più. L'opera sparisce senza errori e senza mail.
   * Questa è la causa più frequente di "non arriva niente e non capisco perché".
   */
  const recoverStale = db.prepare(`
    UPDATE artworks
    SET status = 'queued'
    WHERE status = 'sending'
      AND created_at <= datetime('now', '-2 minutes')
  `);

  const pick = db.prepare(`
    SELECT session_id, email, title, image_path, attempts
    FROM artworks
    WHERE status IN ('queued','failed')
      AND email IS NOT NULL
      AND attempts < ?
      AND sent_at IS NULL
      AND (next_attempt_at IS NULL OR next_attempt_at <= datetime('now'))
    ORDER BY created_at ASC
    LIMIT 5
  `);

  const markSending = db.prepare(`UPDATE artworks SET status='sending' WHERE session_id=?`);
  const markSent = db.prepare(
    `UPDATE artworks SET status='sent', sent_at=datetime('now'), last_error=NULL WHERE session_id=?`,
  );
  /**
   * Il momento del prossimo tentativo è scritto in tabella, non estratto a sorte.
   * La versione precedente usava una probabilità: funzionava in media, ma non
   * era ispezionabile e non dava garanzie sul singolo invio.
   */
  const markFailed = db.prepare(`
    UPDATE artworks
    SET status = 'failed',
        attempts = attempts + 1,
        last_error = ?,
        next_attempt_at = datetime('now', ?)
    WHERE session_id = ?
  `);

  async function tick() {
    const recuperate = Number(recoverStale.run().changes);
    if (recuperate > 0) {
      console.log(`[queue] recuperate ${recuperate} opere rimaste in sospeso`);
    }

    const rows = pick.all(MAX_ATTEMPTS) as unknown as {
      session_id: string;
      email: string;
      title: string;
      image_path: string;
      attempts: number;
    }[];

    for (const row of rows) {
      markSending.run(row.session_id);
      try {
        await mailer.send(
          row.email,
          row.title,
          row.image_path,
          listenBaseUrl ? `${listenBaseUrl}/opera/${row.session_id}` : undefined,
        );
        markSent.run(row.session_id);
        console.log(`[queue] inviata ${row.session_id} a ${mask(row.email)}`);
      } catch (err: any) {
        const attempt = Math.min(row.attempts, BACKOFF_MIN.length - 1);
        const delay = `+${BACKOFF_MIN[attempt]} minutes`;
        const message = String(err?.message ?? err).slice(0, 500);
        markFailed.run(message, delay, row.session_id);
        console.warn(
          `[queue] fallita ${row.session_id} (tentativo ${row.attempts + 1}/${MAX_ATTEMPTS}): ${message}`,
        );
        console.warn(`[queue] prossimo tentativo fra ${BACKOFF_MIN[attempt]} minuti`);
      }
    }
  }

  setInterval(() => void tick(), intervalMs);
  void tick();
}

/** Nei log l'indirizzo va mascherato: restano su disco per settimane. */
function mask(email: string) {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}***@${domain ?? ""}`;
}
