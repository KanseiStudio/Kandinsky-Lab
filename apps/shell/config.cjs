const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { dirname, join } = require("node:path");

/**
 * Configurazione dell'installazione.
 *
 * Sta in un file JSON accanto ai dati, NON dentro l'applicazione: il museo
 * deve poter cambiare la casella di posta o il nome dell'istituzione senza
 * ricompilare e senza chiamare noi. Alla prima accensione il file viene
 * creato con valori vuoti e un commento che spiega cosa mettere.
 *
 * Le password non finiscono mai nel pacchetto distribuito.
 */
const PREDEFINITA = {
  _leggimi: [
    "Configurazione di Kandinsky Lab. Modificare questo file e riavviare l'applicazione.",
    "Le porte SMTP: 465 con secure=true, oppure 587 con secure=false.",
    "Lasciare smtp.host vuoto per disattivare l'invio: le opere si salvano comunque.",
  ],
  smtp: {
    host: "",
    port: 465,
    secure: true,
    user: "",
    pass: "",
    from: "",
  },
  museo: {
    nome: "Museo",
    sito: "https://www.esempio.it",
  },
  kiosk: {
    // false apre in finestra invece che a schermo intero: comodo in prova
    schermoIntero: true,
  },
};

function caricaConfig(percorso) {
  if (!existsSync(percorso)) {
    mkdirSync(dirname(percorso), { recursive: true });
    writeFileSync(percorso, JSON.stringify(PREDEFINITA, null, 2));
    return { config: PREDEFINITA, creata: true, percorso };
  }

  try {
    // Il Blocco note di Windows salva in UTF-8 CON firma iniziale (BOM), e
    // JSON.parse su quel carattere fallisce. È l'errore più frequente quando
    // un file di configurazione viene compilato a mano su Windows, e produce
    // un "file illeggibile" incomprensibile per chi l'ha appena scritto.
    const testo = readFileSync(percorso, "utf8").replace(/^\uFEFF/, "");
    const letta = JSON.parse(testo);
    // Fusione con i valori predefiniti: un file scritto a mano a cui manca
    // una chiave non deve far fallire l'avvio davanti a una classe.
    return {
      config: {
        ...PREDEFINITA,
        ...letta,
        smtp: { ...PREDEFINITA.smtp, ...(letta.smtp ?? {}) },
        museo: { ...PREDEFINITA.museo, ...(letta.museo ?? {}) },
        kiosk: { ...PREDEFINITA.kiosk, ...(letta.kiosk ?? {}) },
      },
      creata: false,
      percorso,
    };
  } catch (err) {
    console.error(`[config] ${percorso} non è un JSON valido: ${err.message}`);
    console.error("[config] controllare virgole e virgolette; uso i valori predefiniti.");
    return { config: PREDEFINITA, creata: false, percorso, errore: String(err.message) };
  }
}

/**
 * Spiega perché l'invio risulta disattivo, campo per campo.
 * "Manca la password" è un'informazione; "SMTP non configurato" non lo è.
 */
function diagnosiSmtp(smtp) {
  const mancanti = ["host", "user", "pass"].filter((k) => !String(smtp?.[k] ?? "").trim());
  if (mancanti.length === 0) return null;
  return `mancano: ${mancanti.join(", ")}`;
}

module.exports = { caricaConfig, diagnosiSmtp };
