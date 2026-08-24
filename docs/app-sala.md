# Applicazione di sala

Un'applicazione autosufficiente: serve l'esperienza, riceve le opere, le salva
su disco e le spedisce per e-mail. Nessun servizio esterno, nessun server da
avviare a parte, nessuna rete necessaria oltre a quella per la posta.

È la forma con cui l'installazione andrà in sala, quindi collaudarla così è
più fedele di qualunque anteprima web.

## Provare senza impacchettare

```bash
pnpm app:dev
```

Compila l'esperienza e apre la finestra. Due scorciatoie:

| | |
|---|---|
| **Ctrl+Alt+Shift+Q** | esce dal chiosco |
| **Ctrl+Alt+Shift+D** | apre la cartella dei dati |

La seconda serve al personale di sala: porta dove stanno configurazione, opere
salvate e coda di invio, senza dover sapere dove cercare.

## Creare l'installatore

```bash
pnpm app:win     # installatore .exe + versione portabile
pnpm app:mac     # .dmg (richiede un Mac: la firma usa strumenti Apple)
```

Il risultato in `apps/shell/release/`. Per Windows escono due file:

- **installatore NSIS** — installazione per tutte le utenze, cartella
  scegliibile, collegamento sul desktop
- **portabile** — un solo `.exe` che gira da chiavetta, utile per una prova
  rapida su un computer non proprio

## Configurazione

Alla prima accensione l'applicazione crea `kandinsky.config.json` nella cartella
dei dati e lo dice a console. Il file sta **fuori dall'applicazione**: sopravvive
agli aggiornamenti e il museo può modificarlo senza ricompilare e senza chiamarci.

```jsonc
{
  "smtp": {
    "host": "mail.esempio.it",   // vuoto = invio disattivato
    "port": 465,                 // 465 con secure true, 587 con secure false
    "secure": true,
    "user": "kandinskylab@esempio.it",
    "pass": "",
    "from": "Kandinsky Lab <kandinskylab@esempio.it>"
  },
  "museo": { "nome": "Museo", "sito": "https://www.esempio.it" },
  "kiosk": { "schermoIntero": true }
}
```

Percorso della cartella dati:

| | |
|---|---|
| Windows | `%APPDATA%\Kandinsky Lab\` |
| macOS | `~/Library/Application Support/Kandinsky Lab/` |

Contiene `kandinsky.config.json`, `outbox.json` (la coda) e `opere/` con i PNG.

**Le password non stanno mai nel pacchetto distribuito.** Si compilano sulla
macchina di sala, dopo l'installazione.

## Come funziona l'invio

Identico al server web, e volutamente: l'applicazione espone la stessa
interfaccia HTTP su `127.0.0.1`, quindi il codice del frontend è lo stesso in
sviluppo, sul web e in sala. Nessun ramo "se sono nell'applicazione".

1. Il bambino conferma l'indirizzo dell'adulto
2. L'opera viene salvata in `opere/` e accodata in `outbox.json`
3. Un lavoratore in sottofondo tenta l'invio ogni 20 secondi
4. In caso di errore riprova con attese crescenti: 1, 5, 15, 60 minuti, poi
   ogni 4 ore, fino a sei tentativi
5. **Appena l'invio riesce l'indirizzo viene cancellato dalla coda.** Anche
   dopo sei tentativi falliti sparisce: è servito a spedire un disegno, non a
   costruire una lista

Con `smtp.host` vuoto le opere si salvano ugualmente e restano in `opere/`.
Per una prova dell'esperienza va benissimo.

### Diagnostica

Con l'applicazione aperta, da un browser sulla stessa macchina non si può
raggiungere il server (ascolta su porta casuale). Il modo previsto è la
scorciatoia **Ctrl+Alt+Shift+D**: in `outbox.json` ogni voce riporta `stato`,
`tentativi` e `ultimoErrore`.

Un `ETIMEDOUT` o `ECONNREFUSED` verso il proprio server di posta significa
quasi sempre porta bloccata dalla rete del museo, non configurazione sbagliata.

## Perché una coda su file e non SQLite

Il server web usa SQLite tramite `node:sqlite`, disponibile da Node 24.
Electron incorpora una versione di Node più vecchia: usarlo qui richiederebbe
un modulo nativo da ricompilare per ogni versione di Electron e per ogni
architettura — esattamente il tipo di dipendenza che fa fallire
un'installazione il giorno del montaggio.

Per una postazione che produce qualche centinaio di opere al giorno, scritte
una alla volta, un file JSON con scrittura atomica è più che sufficiente ed è
ispezionabile con un editor di testo, il che in sala vale parecchio.

## Pacchetto copiabile

```powershell
.\tools\crea-pacchetto-sala.ps1
```

Produce una cartella autosufficiente da copiare su qualsiasi computer Windows,
senza installazione:

```
Kandinsky Lab\
├── Kandinsky Lab.exe             applicazione portabile
├── Avvia Kandinsky Lab.bat       avvio con rilancio automatico
├── LEGGIMI.txt                   istruzioni per il personale di sala
├── installa-avvio-automatico.ps1
└── dati\                         creata alla prima accensione
    ├── kandinsky.config.json
    ├── outbox.json
    └── opere\
```

**I dati stanno dentro la cartella**, non in `%APPDATA%`. È la differenza che
rende il pacchetto davvero copiabile: spostandolo su un'altra macchina si
porta dietro configurazione, coda e opere. L'applicazione se ne accorge da
sola — se la cartella accanto all'eseguibile è scrivibile usa quella,
altrimenti ricade sulla cartella utente di sistema.

Per questo va copiata in un percorso scrivibile: il Desktop o `C:\Kandinsky Lab`
vanno bene, `C:\Programmi` no.

### Il file di avvio

`Avvia Kandinsky Lab.bat` tiene accesa l'applicazione: se si chiude per un
guasto la riapre dopo cinque secondi. In sala è la differenza fra
un'installazione che funziona tutto il giorno e uno schermo con il desktop di
Windows davanti ai visitatori.

**Ctrl+Alt+Maiusc+Q** chiude davvero: l'applicazione lascia un segnale nella
cartella dati che ferma anche il ciclo di rilancio. Senza quel meccanismo non
ci sarebbe modo di spegnerla.

## Avvio automatico

Sulla postazione di sala l'applicazione deve partire da sola all'accensione e
rialzarsi se si chiude. Dalla cartella del progetto, con PowerShell:

Dalla cartella del pacchetto, sulla macchina di sala:

```powershell
.\installa-avvio-automatico.ps1
```

Registra un'attività nell'Utilità di pianificazione. **Non** la cartella
Esecuzione automatica: quella lancia l'applicazione una volta e basta, e se
alle undici del mattino qualcosa va storto lo schermo resta sul desktop di
Windows davanti ai visitatori per il resto della giornata. L'attività invece
riavvia entro un minuto, fino a 999 volte.

Per rimuoverla: `.\tools\installa-avvio-automatico.ps1 -Rimuovi`

### Le tre cose da fare a mano

Lo script non può occuparsene, ma senza queste l'avvio automatico non serve
a niente:

1. **Accesso automatico a Windows.** Altrimenti all'accensione resta la
   schermata di login e nulla parte. Si imposta con `netplwiz`, togliendo la
   spunta a "Per utilizzare questo computer è necessario che l'utente immetta
   nome e password".
2. **Sospensione e spegnimento dello schermo disattivati.** Nelle opzioni di
   risparmio energia, tutto su "Mai". L'applicazione blocca già lo screensaver,
   ma non le impostazioni di sistema.
3. **Riavvii di Windows Update fuori dall'orario di apertura.** Un riavvio a
   metà mostra è il modo più rapido per trovarsi la schermata di accesso
   davanti a una classe.

### Verifica

Riavviare la macchina e cronometrare: l'esperienza deve essere sullo schermo
entro un minuto dall'accensione, senza toccare nulla. È l'unica prova che
conta, e va fatta **prima** del giorno dell'inaugurazione.

## Prima della consegna

- **Firma del codice.** Senza, Windows SmartScreen mostra un avviso al primo
  avvio e macOS blocca l'applicazione del tutto. Su Windows serve un
  certificato di firma; su macOS un account Apple Developer e la notarizzazione.
  Accettabile in prova, non davanti al cliente.
- **Aggiornamenti di sistema disattivati** sulla macchina di sala. Un riavvio a
  metà mostra è il modo più rapido per trovarsi la schermata di accesso davanti
  a una classe.
- **Backup della cartella `opere/`** se il museo vuole conservarle, e per
  contro una verifica che la conservazione sia coerente con l'informativa
  privacy: vedi `docs/privacy.md`.
