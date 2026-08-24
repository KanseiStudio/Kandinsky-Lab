const { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } = require("node:fs");
const { join } = require("node:path");
const nodemailer = require("nodemailer");

/**
 * Consegna delle opere nell'applicazione di sala.
 *
 * Differenza deliberata rispetto al server web: qui la coda è un file JSON,
 * non SQLite.
 *
 * Il motivo non è pigrizia. `node:sqlite` è disponibile da Node 24, mentre
 * Electron ne incorpora una versione più vecchia: usarlo qui obbligherebbe
 * a un modulo nativo da ricompilare per ogni versione di Electron e per ogni
 * architettura, che è esattamente il tipo di dipendenza che fa fallire
 * un'installazione il giorno del montaggio.
 *
 * Per una postazione che produce qualche centinaio di opere al giorno,
 * scritte una alla volta, un file va benissimo.
 */
class Consegna {
  constructor({ dataDir, config, log = console }) {
    this.dataDir = dataDir;
    this.config = config;
    this.log = log;
    this.imagesDir = join(dataDir, "opere");
    this.outboxPath = join(dataDir, "outbox.json");
    this.transport = null;
    this.timer = null;

    mkdirSync(this.imagesDir, { recursive: true });
  }

  get attivo() {
    const { smtp } = this.config;
    return Boolean(smtp?.host && smtp?.user && smtp?.pass);
  }

  // --- Coda ----------------------------------------------------------------

  leggiCoda() {
    try {
      // La firma iniziale UTF-8 che il Blocco note aggiunge farebbe fallire
      // JSON.parse, e con essa sparirebbe l'intera coda in silenzio.
      return JSON.parse(readFileSync(this.outboxPath, "utf8").replace(/^\uFEFF/, ""));
    } catch (err) {
      if (existsSync(this.outboxPath)) {
        this.log.error(`[consegna] outbox.json illeggibile: ${err.message}`);
      }
      return [];
    }
  }

  scriviCoda(coda) {
    // Scrittura atomica: un'interruzione di corrente a metà salvataggio
    // lascerebbe un JSON troncato, e con esso l'intera coda illeggibile.
    const tmp = `${this.outboxPath}.tmp`;
    writeFileSync(tmp, JSON.stringify(coda, null, 1));
    writeFileSync(this.outboxPath, readFileSync(tmp));
    unlinkSync(tmp);
  }

  /** Salva l'opera su disco e la accoda se c'è un indirizzo. */
  accoda(opera) {
    const nomeFile = `${opera.createdAt.slice(0, 10)}_${opera.sessionId}.png`;
    const percorso = join(this.imagesDir, nomeFile);
    writeFileSync(percorso, Buffer.from(opera.imageBase64, "base64"));

    const coda = this.leggiCoda();
    coda.push({
      sessionId: opera.sessionId,
      title: opera.title || "Senza titolo",
      imagePath: percorso,
      email: opera.email ?? null,
      score: opera.score ?? null,
      createdAt: opera.createdAt,
      tentativi: 0,
      prossimoTentativo: 0,
      stato: opera.email ? "in_coda" : "archiviata",
      ultimoErrore: null,
    });
    this.scriviCoda(coda);

    this.log.log(
      `[consegna] opera ${opera.sessionId} salvata` +
        (opera.email ? " e messa in coda" : " (nessun indirizzo)"),
    );
    return { queued: Boolean(opera.email), path: percorso };
  }

  // --- Invio ---------------------------------------------------------------

  creaTransport() {
    if (this.transport) return this.transport;
    const { smtp } = this.config;
    this.transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port ?? 465,
      secure: smtp.secure ?? true,
      auth: { user: smtp.user, pass: smtp.pass },
      pool: true,
      maxConnections: 1,
      rateDelta: 60000,
      rateLimit: 20,
    });
    return this.transport;
  }

  async inviaUna(voce) {
    const { smtp, museo } = this.config;
    await this.creaTransport().sendMail({
      from: smtp.from || smtp.user,
      to: voce.email,
      subject: `La tua opera Kandinsky Lab: ${voce.title}`,
      text: [
        "Hai creato qualcosa che prima non esisteva.",
        "",
        `"${voce.title}"`,
        "",
        `Grazie per aver partecipato a Kandinsky Lab presso ${museo.nome}.`,
        "In allegato trovi la tua opera digitale.",
        "",
        "Continua a giocare con colori, forme e immaginazione.",
        museo.sito,
      ].join("\n"),
      html: this.html(voce),
      attachments: [
        { filename: `${slug(voce.title)}.png`, path: voce.imagePath, cid: "opera" },
      ],
    });
  }

  html(voce) {
    const { museo } = this.config;
    const esc = (t) =>
      String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    return `
<div style="font-family:Georgia,serif;max-width:640px;margin:0 auto;padding:40px 24px;color:#141414">
  <p style="font-size:22px;line-height:1.4;margin:0 0 28px">Hai creato qualcosa che prima non esisteva.</p>
  <img src="cid:opera" alt="${esc(voce.title)}" style="width:100%;border:3px solid #141414" />
  <p style="font-size:26px;font-weight:700;margin:24px 0 4px">${esc(voce.title)}</p>
  <p style="font-size:14px;color:#5A5347;margin:0 0 32px">creata con Kandinsky Lab · ${esc(museo.nome)}</p>
  <p style="font-size:16px;line-height:1.6">Continua a giocare con colori, forme e immaginazione.</p>
  <p style="font-size:14px;color:#5A5347;margin-top:40px">
    Questo indirizzo è stato usato solo per inviarti il disegno e viene cancellato dopo l'invio.
    <br /><a href="${esc(museo.sito)}" style="color:#1B3A93">${esc(museo.nome)}</a>
  </p>
</div>`;
  }

  /** backoff progressivo: 1, 5, 15, 60 minuti, poi ogni 4 ore */
  attesa(tentativi) {
    const minuti = [1, 5, 15, 60, 240, 240];
    return minuti[Math.min(tentativi, minuti.length - 1)] * 60_000;
  }

  async giro() {
    if (!this.attivo) return;

    const coda = this.leggiCoda();
    const adesso = Date.now();
    let modificata = false;

    for (const voce of coda) {
      if (voce.stato !== "in_coda" || !voce.email) continue;
      if (voce.prossimoTentativo > adesso) continue;
      if (voce.tentativi >= 6) {
        // Esauriti i tentativi l'indirizzo sparisce comunque: non deve
        // restare su disco a tempo indeterminato per un invio mai riuscito.
        voce.stato = "fallita";
        voce.email = null;
        modificata = true;
        continue;
      }

      try {
        await this.inviaUna(voce);
        voce.stato = "inviata";
        voce.inviataIl = new Date().toISOString();
        // Cancellazione immediata dell'indirizzo: è servito a spedire un
        // disegno, non a costruire una lista.
        voce.email = null;
        voce.ultimoErrore = null;
        this.log.log(`[consegna] inviata ${voce.sessionId}`);
      } catch (err) {
        voce.tentativi += 1;
        voce.ultimoErrore = String(err?.message ?? err).slice(0, 300);
        voce.prossimoTentativo = adesso + this.attesa(voce.tentativi);
        this.log.warn(
          `[consegna] fallita ${voce.sessionId} (${voce.tentativi}/6): ${voce.ultimoErrore}`,
        );
      }
      modificata = true;
    }

    if (modificata) this.scriviCoda(coda);
  }

  avvia(intervalloMs = 20_000) {
    if (!this.attivo) {
      this.log.warn(
        "[consegna] SMTP non configurato: le opere si salvano in " +
          `${this.imagesDir} ma non vengono spedite.`,
      );
      return;
    }
    this.creaTransport()
      .verify()
      .then(
        () => this.log.log("[consegna] SMTP verificato"),
        (e) => this.log.warn(`[consegna] SMTP non raggiungibile: ${e.message}`),
      );
    this.timer = setInterval(() => void this.giro(), intervalloMs);
    void this.giro();
  }

  ferma() {
    if (this.timer) clearInterval(this.timer);
    this.transport?.close();
  }

  /** Riepilogo per la diagnostica di sala. */
  stato() {
    const coda = this.leggiCoda();
    const per = (s) => coda.filter((v) => v.stato === s).length;
    return {
      smtp: this.attivo ? "configurato" : "assente",
      totale: coda.length,
      in_coda: per("in_coda"),
      inviate: per("inviata"),
      fallite: per("fallita"),
      archiviate: per("archiviata"),
      ultimiErrori: coda
        .filter((v) => v.ultimoErrore)
        .slice(-5)
        .map((v) => ({ sessionId: v.sessionId, errore: v.ultimoErrore, tentativi: v.tentativi })),
    };
  }
}

function slug(s) {
  return (
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "opera"
  );
}

module.exports = { Consegna };
