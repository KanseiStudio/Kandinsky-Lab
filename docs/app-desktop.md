# Applicazione desktop

L'esperienza in un'applicazione autonoma: parte in due secondi, funziona senza
rete, non dipende da nessun servizio. È anche la forma con cui andrà in sala,
quindi collaudarla così è più fedele di qualunque anteprima web.

## Provare subito, senza impacchettare

Su qualunque sistema, dalla radice del progetto:

```bash
pnpm app:dev
```

Compila l'esperienza e apre la finestra a schermo intero.
Per uscire: **Ctrl/Cmd + Alt + Shift + Q**.

## Creare l'applicazione

```bash
pnpm app:mac     # .dmg per Apple Silicon e Intel
pnpm app:win     # installatore .exe
pnpm --filter @kandinsky/shell pack:dir   # solo la cartella, senza installatore
```

Il risultato finisce in `apps/shell/release/`.

### Il .dmg richiede un Mac

Non è una limitazione aggirabile: la firma del codice per macOS usa strumenti
di sistema Apple, e Electron non compila verso macOS da Windows o Linux.
Serve una macchina Apple con Node 24 e pnpm installati, dove si clona il
repository e si lancia `pnpm install && pnpm app:mac`.

## Cosa contiene

```
Kandinsky Lab.app
├── main.cjs, server.cjs      guscio e server interno
└── Resources/
    ├── kiosk/                l'esperienza compilata
    └── content/              elementi, tavolozze, didascalie, asset
```

`content` resta una cartella separata anche dentro l'applicazione: per
correggere una didascalia o sostituire una forma basta modificare il file
lì dentro, senza ricompilare nulla. Su macOS si arriva con
*Mostra contenuto pacchetto → Contents/Resources/content*.

## Perché un server interno e non file://

L'applicazione avvia un piccolo server su `127.0.0.1` con una porta assegnata
dal sistema, e la finestra carica da lì.

Con il protocollo `file://` i moduli ES e le richieste verso `/content`
falliscono entrambi per le regole di origine dei browser. Il server interno
risolve il problema senza esporre nulla: ascolta solo sull'interfaccia di
loopback, quindi nessun altro dispositivo della rete del museo può
raggiungerlo.

## Cosa non c'è

L'applicazione desktop **non invia le opere per e-mail**: quella parte richiede
il server con la coda di consegna. Per la sala si prevedono due processi sulla
stessa macchina, o il server su un piccolo computer di rete.

Per il collaudo dell'esperienza — disegno, forme, musica, testina, coda finale —
non serve, e la sua assenza toglie di mezzo ogni problema di configurazione.

## Prima della consegna al museo

- **Firma e notarizzazione (macOS).** Senza, al primo avvio Gatekeeper blocca
  l'applicazione e serve il giro da *Impostazioni → Privacy e sicurezza → Apri
  comunque*. Accettabile in prova, non davanti al cliente. Richiede un account
  Apple Developer.
- **Avvio automatico** all'accensione e riavvio in caso di chiusura: su macOS
  con un LaunchAgent, su Windows con l'Utilità di pianificazione.
- **Disattivare gli aggiornamenti automatici del sistema** sulla macchina di
  sala. Un riavvio a metà mostra è il modo più rapido per trovarsi lo schermo
  con la schermata di accesso davanti a una classe.
