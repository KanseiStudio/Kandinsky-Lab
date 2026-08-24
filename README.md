# Kandinsky Lab

Atelier digitale interattivo per bambini. Tavolo touch orizzontale 1920×1080.

Il bambino dipinge con le dita, trascina forme tratte dal vocabolario visivo di
Kandinsky, le compone liberamente — e mentre lo fa **compone anche una musica**.
Ogni colore ha un timbro, ogni forma un ruolo musicale, e l'arrangiamento cresce
insieme al quadro. Alla fine dà un titolo all'opera e la riceve via e-mail, con un
link per riascoltare la propria firma sonora.

## Requisiti

**Node 24 o superiore** (il server usa `node:sqlite`, integrato nel runtime).
Nessun modulo nativo, quindi nessun compilatore C++ da installare.

```bash
node --version   # deve dire v24 o superiore
corepack enable  # attiva pnpm alla versione dichiarata nel repo
```

## Avvio rapido

```bash
pnpm install
cp apps/server/.env.example apps/server/.env   # compilare SMTP
pnpm dev
```

Aprire `http://localhost:5180`. Su desktop il layout viene scalato per stare a schermo;
in sala gira a 1:1 dentro Electron.

`packages/content` viene servito automaticamente sotto `/content` da un plugin Vite,
in sviluppo dal disco e in build copiato accanto all'output. Non serve nessun symlink,
e i contenuti restano modificabili senza ricompilare.

Il `.env` del server è opzionale: senza SMTP configurato le opere vengono comunque
salvate e messe in coda, e partono quando le credenziali arrivano. Per configurarlo:

```bash
cp apps/server/.env.example apps/server/.env
```

Per verificare l'SMTP prima di collegarlo al flusso:

```bash
pnpm --filter @kandinsky/server mail:test tuo.indirizzo@esempio.it
```

Se le opere non arrivano, `GET /api/queue` mostra l'ultimo errore per ognuna.

## Applicazione desktop

```bash
pnpm app:dev     # apre l'esperienza a schermo intero, senza impacchettare
pnpm app:mac     # .dmg (richiede un Mac)
pnpm app:win     # installatore Windows
```

Uscita dal chiosco: **Ctrl/Cmd + Alt + Shift + Q**. Dettagli in
`docs/app-desktop.md`.

## Applicazione di sala

Autosufficiente: serve l'esperienza, salva le opere e le spedisce, senza
servizi esterni.

```bash
pnpm app:dev     # prova senza impacchettare
pnpm app:win     # installatore Windows + versione portabile
pnpm app:mac     # .dmg (richiede un Mac)
```

Uscita **Ctrl+Alt+Shift+Q**, cartella dati **Ctrl+Alt+Shift+D**.
Dettagli in `docs/app-sala.md`.

## Pubblicare l'anteprima

Un solo processo Node serve esperienza, contenuti e API, protetti da una
password unica. Guida completa in `docs/deploy.md`.

```bash
pnpm build
APP_PASSWORD=scegli-una-password pnpm start   # http://localhost:8787
```

## Struttura

| Percorso | Cosa contiene |
|---|---|
| `apps/kiosk` | Esperienza touch. Konva per la tela, DOM diretto per l'interfaccia |
| `apps/server` | API locale, coda di invio, cancellazione automatica degli indirizzi |
| `apps/shell` | Guscio Electron: fullscreen, screensaver bloccato, auto-restart |
| `packages/schema` | Schemi Zod condivisi. Unica fonte di verità dei tipi |
| `apps/kiosk/src/audio` | Motore musicale generativo su Tone.js |
| `packages/content` | Elementi, tavolozze, didascalie, asset. Modificabili senza rebuild |
| `docs` | Specifiche asset, layout di sala, note privacy |

## Il modello dati in breve

Quattro librerie indipendenti, tenute insieme solo da id:

- **elementi** — cosa si può trascinare, con provenienza, diritti e **ruolo musicale**
- **tavolozze** — quali colori sono disponibili e che **timbro** hanno, derivati da opere reali
- **didascalie** — cosa si racconta e *quando*, agganciato a trigger e non a singole forme
- **suono** — tonalità, tempo, budget di voci, regole di sonificazione del tratto

Il sistema sonoro si regge su una moltiplicazione: il **colore** decide il timbro,
la **forma** decide il ruolo musicale. Otto colori per dodici forme danno novantasei
comportamenti sonori da una manciata di righe di JSON.

La separazione fra elementi e didascalie è deliberata: il curatore aggiunge un contenuto
senza toccare la grafica, e un contenuto può scattare su una categoria, su un colore,
dopo N forme posate o alla chiusura dell'opera.

## Hardware di riferimento

Mini-PC Windows 11, i5 / 16 GB, grafica integrata sufficiente. Pannello touch capacitivo
o IR a 10 tocchi, 1920×1080, montato orizzontale ad altezza 70–75 cm. Rete cablata
preferibile: l'app funziona anche offline, ma le opere restano in coda.

**Audio**: cupola sonora direzionale sopra la postazione. È la voce di preventivo che
decide se il progetto funziona davvero in una galleria o se il volume finisce a zero
entro due giorni. Vedi `docs/audio-design.md`.

## Licenza

Codice: proprietario, Kansei Studio S.r.l.
Font: SIL OFL. Asset grafici: vedi `provenance.rights` in `elements.json`.
