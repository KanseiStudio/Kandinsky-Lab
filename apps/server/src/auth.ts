import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

/**
 * Accesso protetto da password, per la fase di prova.
 *
 * Autenticazione HTTP di base: nessuna pagina di login da costruire, nessun
 * cookie, nessuna sessione da gestire. Il browser mostra il proprio dialogo
 * e ricorda le credenziali finché resta aperto.
 *
 * Due avvertenze da non ignorare:
 *
 * 1. **Serve HTTPS.** L'autenticazione di base trasmette la password
 *    codificata in base64, non cifrata: su http:// viaggia in chiaro.
 *    Tutti i servizi di hosting citati in docs/deploy.md forniscono il
 *    certificato in automatico.
 * 2. **Non è una misura di sicurezza forte.** Serve a tenere l'anteprima
 *    fuori dai motori di ricerca e dalle mani sbagliate, non a proteggere
 *    dati sensibili. Quando l'installazione andrà in sala, il chiosco
 *    girerà in locale e questa protezione non servirà più.
 */
export function basicAuth(user: string, password: string): RequestHandler {
  const atteso = Buffer.from(`${user}:${password}`);

  return (req, res, next) => {
    // Il controllo di salute resta aperto: i servizi di hosting lo
    // interrogano senza credenziali e altrimenti riavviano l'applicazione
    // in continuazione credendola guasta.
    if (req.path === "/api/health") return next();

    const header = req.headers.authorization ?? "";
    const [schema, valore] = header.split(" ");

    if (schema === "Basic" && valore) {
      const fornito = Buffer.from(valore, "base64");
      // Confronto a tempo costante: con un confronto normale la durata
      // della risposta rivela quanti caratteri iniziali sono corretti.
      if (fornito.length === atteso.length && timingSafeEqual(fornito, atteso)) {
        return next();
      }
    }

    res.set("WWW-Authenticate", 'Basic realm="Kandinsky Lab", charset="UTF-8"');
    res.status(401).type("text/plain").send("Accesso riservato.");
  };
}
