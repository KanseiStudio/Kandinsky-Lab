# Kandinsky Lab — istruzioni per Claude Code

Atelier digitale interattivo su tavolo touch orizzontale 1920×1080, per bambini 5–12 anni,
in contesto museale. Cliente finale: museo / istituzione culturale. Produzione: Kansei Studio.

**Tre dimensioni, non due**: visiva (colori, segni, composizione), tattile (tocco e
manipolazione), **sonora** (timbri, ritmo, musica generativa). Il suono non è un
accompagnamento: è la seconda rappresentazione della stessa composizione. Leggere
`docs/audio-design.md` prima di toccare qualsiasi cosa in `apps/kiosk/src/audio/`.

## Comandi

```bash
pnpm install
pnpm dev              # kiosk (5180) + server (8787) in parallelo
pnpm dev:kiosk
pnpm dev:server       # richiede apps/server/.env, vedi .env.example
pnpm typecheck        # da far passare prima di ogni commit
pnpm package:kiosk    # build Electron per Windows
```

## Architettura in una riga

Vite + TypeScript + Konva per la tela; Tone.js per la musica generativa; Express +
SQLite + Nodemailer per la consegna; Electron come guscio kiosk; contenuti in JSON
validati con Zod, **fuori dal bundle**.

```
apps/kiosk     frontend dell'esperienza (nessun framework UI, DOM diretto)
  src/canvas     Konva: pittura, elementi, gesti, export
  src/audio      Tone.js: teoria, timbri, compositore, sonificazione del tratto
apps/server    API locale, coda di invio, retention dei dati personali
               (SQLite via `node:sqlite`, nessun modulo nativo)
apps/shell     Electron: fullscreen, no screensaver, riavvio automatico.
               Serve l'esperienza da un server interno su 127.0.0.1, non da
               file://, perché con quel protocollo i moduli ES e le richieste
               verso /content falliscono per le regole di origine.
packages/schema  Zod: unica fonte di verità dei tipi, condivisa fra kiosk e server
packages/content elements.json, palettes.json, didactics.json, brushes.json,
                 sound.json, assets/
```

## Invarianti da non rompere

1. **I contenuti non stanno nel codice.** Nessun testo didattico, nessun colore di
   tavolozza, nessun elenco di forme hardcoded in un `.ts`. Tutto passa da
   `packages/content/data/*.json` e da `packages/schema`. Il museo deve poter aggiungere
   una forma o correggere una didascalia senza ricompilare.
2. **Il multitouch è per-pointer.** Ogni `pointerId` ha il proprio stato. Mai una
   variabile `currentStroke` singola: su un tavolo orizzontale dipingono due bambini
   insieme. Vale per `paint.ts`, `gestures.ts` e il routing in `stage.ts`.
3. **La rete non blocca mai il bambino.** Ogni invio passa dall'outbox in
   `api/client.ts`. Se il server è giù l'opera si accoda e l'esperienza prosegue.
4. **L'e-mail è un dato effimero.** Entra solo nella schermata finale, con consenso
   esplicito e versionato, e viene cancellata dal DB dopo l'invio (`retention.ts`).
   Non aggiungere colonne che colleghino l'indirizzo ad altro.
5. **Lo stage Konva resta a 1920x1080 con scala 1.** L'adattamento allo schermo
   lo fa la trasformazione CSS su `#frame`. Scalare anche lo stage produce una
   doppia scala: il punto toccato non coincide con quello disegnato e il ritaglio
   dell'export si sposta. Le coordinate passate a `toDataURL` sono di progetto.
6. **Target touch minimo 88px.** I bambini piccoli hanno bassa precisione e sul vetro
   orizzontale il dito arriva più piatto. Nessun controllo sotto quella soglia.
7. **Nessuna dipendenza da rete a runtime.** I font arrivano dai pacchetti
   `@fontsource*` e finiscono nel bundle: nessun CDN, nessun Google Fonts, nessuna
   cartella `/fonts` da tenere allineata. Il chiosco deve partire col cavo staccato.
8. **Nessuna nota fuori scala, mai.** Ogni suono passa da `audio/theory.ts`, che
   quantizza alla scala e alla tonalità di `sound.json`. Non esistono percorsi
   alternativi per generare un'altezza. È così che si mantiene la promessa
   "non esiste una nota sbagliata".
9. **I synth si costruiscono una volta sola**, all'avvio, in `audio/voices.ts`.
   Creare nodi Web Audio a runtime porta al crash dopo qualche ora di apertura.
   **Si suona solo tramite `AudioEngine.play()` e `playChord()`**: chiamare i synth
   direttamente aggira impilamento armonico, filtro dinamico e panning, e riporta
   il timbro alle onde singole della prima versione.
10. **La musica si trasforma, non si accumula.** Oltre `maxVoices` lo strato più
   vecchio viene ritirato in dissolvenza. Rimuovere questo limite significa
   ottenere fango sonoro alla ventesima forma.
11. **L'audio si sblocca solo sul tap "Inizia".** È l'unico gesto garantito dal
    flusso; agganciarlo altrove significa esperienze mute e irriproducibili.
12. **La testina di lettura sta nella barra superiore, allineata all'artboard.**
    `canvas.artboard.x` e `.width` in config governano sia la tela sia la traccia:
    sono legate. Disallinearle rompe la corrispondenza verticale fra indicatore e
    forma, che è l'unica cosa che rende leggibile il meccanismo. Lo spazio a destra
    della traccia (da 1824 a 1896) è occupato dal pulsante info: allargando
    l'artboard va spostato.
    Nota su `translateX`: le percentuali si riferiscono all'elemento, non al
    contenitore. Il cursore si muove in pixel, i puntini usano `left` in percento.
13. **Il tempo lo decide la posizione X delle forme**, non un loop per strato.
    Il `Sequencer` legge le posizioni correnti a ogni sedicesimo, così trascinare
    una forma mentre suona cambia la musica senza notifiche esplicite.
14. **La firma sonora viaggia come partitura, non come audio.** `Score` in JSON,
    ricostruita nel browser. Non introdurre rendering offline né allegati audio.

## Convenzioni

- TypeScript strict. Nessun `any` nel codice nuovo se non nei confini con Konva.
- Commenti in italiano, in prosa, solo dove spiegano **perché** — non cosa fa la riga.
- Nomi di file e simboli in inglese, testi utente in italiano.
- Konva: `perfectDrawEnabled: false` e `shadowForStrokeEnabled: false` su tutti i nodi
  della tela. Sono la differenza fra 60 e 25 fps quando ci sono 40 elementi.
- Ogni nuova proprietà di contenuto va prima nello schema Zod, poi nel JSON, poi nell'UI.

## Stato attuale

Fatto: schema dati completo (incluso audio), motore pittura multitouch, motore elementi
con pinch/rotate, motore didattico a trigger, motore musicale generativo (teoria, timbri,
compositore a strati, sonificazione del tratto), export ad alta risoluzione con cartiglio,
flusso a sei schermate, outbox client, API + coda + retention + endpoint partitura,
guscio Electron. Quattro tavolozze derivate da opere reali (Giallo Rosso Blu 1925,
Macchia rossa 1921, Mosca I 1916, Composition X 1939).

Da fare, in ordine:

1. **Asset grafici.** `packages/content/assets/elements/` è vuoto. Servono PNG @2x con
   alpha secondo `docs/asset-spec.md`. Finché mancano, il vassoio è vuoto.
2. **Dialogo "Ricomincia" a schermo intero** — ora c'è un `window.confirm()`, inaccettabile
   in sala (vedi `confirmClear()` in `main.ts`).
3. **Filtro parolacce** sul titolo, lato server (`sanitizeTitle` in `apps/server/src/index.ts`).
4. **Localizzazione**: i testi delle schermate in `ui/screens.ts` sono ancora hardcoded in
   italiano; vanno spostati in `content/data/strings.json`.
5. **Undo unificato**: oggi annulla solo i tratti, non gli elementi posati. Serve uno stack
   unico di comandi in `stage.ts`.
6. ~~Backoff della coda~~ — fatto: `next_attempt_at` in tabella, più recupero delle
   righe rimaste in `sending` dopo un riavvio.
7. **Modalità doppia postazione** (`mirrorToolbars`): tavolozza speculare sui due lati
   lunghi. Il flag esiste in config ma non è implementato.
8. **Pagina di riascolto** `/opera/:sessionId`: legge la partitura dall'endpoint e la
   riproduce con lo stesso motore. È il link che finisce nell'e-mail. Da costruire.
9. ~~Coda finale composta~~ — fatto: `composer.finale()` chiude in tre tempi.
10. **Tavolozza scura**: `darkCanvas` esiste nello schema e la palette Composition X lo
    usa, ma l'interfaccia non inverte ancora i contrasti.

## Pubblicazione

`docs/deploy.md`. In produzione il server Express serve anche `apps/kiosk/dist`
e `packages/content`: stessa origine, quindi `server.baseUrl` in configurazione
va lasciato vuoto e il client usa `window.location.origin`.

`APP_PASSWORD` attiva l'autenticazione di base su tutto tranne `/api/health`,
che deve restare aperto o i servizi di hosting riavviano l'applicazione in ciclo.

**Niente API del browser che richiedano contesto sicuro senza fallback.**
`crypto.randomUUID` non esiste su `http://` fuori da localhost: è il motivo per
cui esiste `app/uuid.ts`. Vale per qualunque cosa si aggiunga in futuro.

## Trappole di tipo

**`vite build` non controlla i tipi**, trascrive e basta. Per questo la build del
kiosk è `tsc --noEmit && vite build`: senza, un oggetto a cui manca una proprietà
obbligatoria passa la compilazione e fallisce nel browser.

**`maxPolyphony` non è un'opzione di voce.** `new Tone.PolySynth(Tone.Synth, opts)`
passa le opzioni alla singola voce; `maxPolyphony` è una proprietà del PolySynth
e va assegnata dopo la costruzione. Messa fra le opzioni viene ignorata in
silenzio, e ogni timbro resta sul predefinito di 32 voci.

**Il server si compila con esbuild, non con `tsc`.** `tsc` non riscrive gli alias
di `paths`, quindi l'import di `@kandinsky/schema` resterebbe nel JavaScript
emesso e fallirebbe a runtime; e includendo un file fuori da `src` sposta la
radice comune, scrivendo in `dist/apps/server/src/` invece che in `dist/`.
`tsc --noEmit` resta per il controllo dei tipi, che esbuild non fa.

**CSS da npm si importa da JavaScript, non con `@import`.** Un `@import` con nome
di pacchetto dentro un foglio di stile finisce a postcss-import, che lo tratta
come percorso relativo alla cartella del foglio e fallisce in build. I font
stanno quindi in cima a `main.ts`.

`node:sqlite` dichiara `changes` e `lastInsertRowid` come `number | bigint`:
vanno sempre avvolti in `Number(...)` prima di sommarli o serializzarli, o
`tsc` fallisce in build mentre `tsx` in sviluppo non se ne accorge.

## Cose da non fare

- Non introdurre React o altri framework UI: il chiosco resta acceso otto ore al giorno,
  il DOM diretto è più prevedibile e la superficie di manutenzione è minore.
- Non spostare i PNG dentro SQLite.
- Non reintrodurre `better-sqlite3` né altri moduli nativi. Il database usa
  `node:sqlite`, integrato in Node: niente node-gyp, niente Visual Studio Build
  Tools, niente compilazione sul mini-PC del museo. Ogni dipendenza nativa è un
  fallimento di installazione che si manifesta il giorno del montaggio in sala.
- Non aggiungere analytics di terze parti. Le statistiche restano locali e anonime.
- Non usare `localStorage` per lo stato dell'opera in corso: serve solo all'outbox.
- Non aggiungere musica di sottofondo pre-registrata. Tutto il suono nasce dai gesti;
  una base fissa distruggerebbe il senso dell'esperienza.
- Non alzare `masterGain` oltre `audio.maxGain`. Il tetto esiste perché in sala,
  se il volume si può alzare, prima o poi qualcuno lo alza.
- Non associare mai una forma a un significato univoco nel codice ("il cerchio significa
  armonia"). Le interpretazioni stanno nelle didascalie, che sono responsabilità del
  curatore e vanno validate da lui.

## Il rischio numero uno: l'audio in sala

Otto ore al giorno di musica generativa in una galleria disturbano tutto ciò che sta
intorno. Se il personale può abbassare il volume, entro due giorni lo porta a zero e
metà del concept sparisce. La risposta corretta è una **cupola sonora direzionale**
sopra la postazione, da mettere a preventivo fin da subito. Dettagli in
`docs/audio-design.md`.

## Contesto artistico e diritti

Kandinsky è morto nel 1944: le opere sono in pubblico dominio in Italia. La **riproduzione
fotografica** ad alta risoluzione può però avere diritti propri dell'istituzione che la
produce. Ogni elemento ha `provenance.rights`; tutto ciò che è `to-verify` va chiarito
prima della messa in sala. Le forme originali disegnate da noi (`original-artwork`) non
hanno questo problema ed è la strada preferibile per il grosso della libreria.
