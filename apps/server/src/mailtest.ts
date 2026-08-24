/**
 * Verifica della configurazione SMTP, isolata dal resto dell'applicazione.
 *
 *   pnpm --filter @kandinsky/server mail:test destinatario@esempio.it
 *
 * Serve a separare due domande che altrimenti si confondono:
 * "l'SMTP funziona?" e "la coda funziona?". Se questo script passa e le
 * opere non partono, il problema è nella coda; se fallisce qui, è nel .env
 * o nel provider, e il messaggio di errore lo dice.
 */
import nodemailer from "nodemailer";

const to = process.argv[2];
if (!to) {
  console.error("Uso: pnpm --filter @kandinsky/server mail:test destinatario@esempio.it");
  process.exit(1);
}

const host = process.env.SMTP_HOST;
const user = process.env.SMTP_USER;
const port = Number(process.env.SMTP_PORT ?? 587);
const secure = process.env.SMTP_SECURE === "true";
const from = process.env.MAIL_FROM ?? user;

console.log("Configurazione letta:");
console.log(`  host    ${host ?? "(mancante)"}`);
console.log(`  porta   ${port}  secure=${secure}`);
console.log(`  utente  ${user ?? "(mancante)"}`);
console.log(`  da      ${from ?? "(mancante)"}`);
console.log(`  password ${process.env.SMTP_PASS ? "impostata" : "(mancante)"}`);
console.log();

if (!host || !user || !process.env.SMTP_PASS) {
  console.error("Configurazione incompleta. Controlla apps/server/.env");
  process.exit(1);
}

// Combinazione porta/secure sbagliata: è l'errore più comune e produce
// un timeout senza spiegazioni, quindi lo intercettiamo prima di provare.
if (port === 465 && !secure) {
  console.warn("Attenzione: la porta 465 richiede SMTP_SECURE=true. Con false andrai in timeout.");
}
if (port === 587 && secure) {
  console.warn("Attenzione: la porta 587 usa STARTTLS, quindi SMTP_SECURE=false.");
}

const transport = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: { user, pass: process.env.SMTP_PASS },
  connectionTimeout: 10_000,
  logger: true,
});

try {
  await transport.verify();
  console.log("\nConnessione e autenticazione riuscite.");

  const info = await transport.sendMail({
    from,
    to,
    subject: "Kandinsky Lab — prova di configurazione",
    text: "Se leggi questo messaggio, l'SMTP del chiosco è configurato correttamente.",
  });

  console.log(`Messaggio accettato dal server: ${info.messageId}`);
  console.log(`Destinatari accettati: ${info.accepted.join(", ")}`);
  if (info.rejected.length) console.warn(`Rifiutati: ${info.rejected.join(", ")}`);
  process.exit(0);
} catch (err: any) {
  console.error("\nInvio fallito.");
  console.error(`  ${err?.message}`);
  const hints: Record<string, string> = {
    EAUTH: "Credenziali rifiutate. Con Gmail serve una password per le app, non quella dell'account.",
    ETIMEDOUT: "Nessuna risposta. Controlla host, porta e la combinazione porta/secure.",
    ECONNECTION: "Connessione rifiutata. Spesso è il firewall o la porta sbagliata.",
    ESOCKET: "Errore TLS. Di solito SMTP_SECURE non corrisponde alla porta.",
    EENVELOPE: "Mittente rifiutato. Molti provider esigono che MAIL_FROM sia l'utente autenticato.",
  };
  if (err?.code && hints[err.code]) console.error(`  ${hints[err.code]}`);
  process.exit(1);
}
