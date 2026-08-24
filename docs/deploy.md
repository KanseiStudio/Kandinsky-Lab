# Pubblicare l'anteprima

Obiettivo: un indirizzo web protetto da password, da mandare a chi deve provare
l'esperienza. Non è la configurazione di sala — quella gira in locale dentro
Electron e non ha bisogno di nulla di tutto questo.

## Come funziona

In produzione **un solo processo Node serve tutto**: l'esperienza compilata, i
contenuti e le API. Un dominio, una password che copre ogni cosa, niente CORS
da configurare.

```
browser ──HTTPS──▶ Node (Express)
                   ├─ /            esperienza compilata (apps/kiosk/dist)
                   ├─ /content     elementi, tavolozze, didascalie
                   └─ /api/*       opere, coda, partiture
```

## 1. Password

In `apps/server/.env`:

```bash
APP_USER=kandinsky
APP_PASSWORD=scegli-una-password-lunga
```

Se `APP_PASSWORD` è vuota il server parte comunque, ma **senza protezione** e
lo dice a console. Il controllo `/api/health` resta sempre aperto: i servizi di
hosting lo interrogano senza credenziali e altrimenti riavviano l'applicazione
in continuazione credendola guasta.

Per cambiare password basta modificare la variabile e riavviare. Chi era già
entrato resta dentro finché non chiude il browser.

## 2. Compilare

```bash
pnpm install
pnpm build      # compila esperienza e server
pnpm start      # avvia sulla porta 8787
```

Provare in locale su `http://localhost:8787` **prima** di pubblicare: se
funziona lì, l'unica variabile che resta è l'hosting.

## 3. Pubblicare su Render

Nel repository c'è `render.yaml`: Render lo legge e configura tutto da solo.

### Preparazione

Il progetto deve stare su un repository Git (GitHub, GitLab o Bitbucket).
**Il lockfile `pnpm-lock.yaml` va incluso**: il comando di build usa
`--frozen-lockfile`, che senza fallisce.

```bash
git init
git add .
git commit -m "Kandinsky Lab"
git remote add origin <indirizzo-del-repository>
git push -u origin main
```

Controllare che `apps/server/.env` **non** finisca nel commit: è già in
`.gitignore`, ma vale la pena verificarlo, perché contiene la password SMTP.

### Creazione del servizio

1. Su Render: **New → Blueprint**, e selezionare il repository.
   Render trova `render.yaml` e propone il servizio già configurato.
2. Chiede le due variabili marcate `sync: false`, che non stanno nel
   repository per ovvie ragioni:
   - `APP_PASSWORD` — la password d'accesso all'anteprima
   - `SMTP_PASS` — la password della casella di posta
3. **Apply**. La prima build richiede qualche minuto: scarica le dipendenze,
   compila l'esperienza e il server.

L'indirizzo sarà `https://kandinsky-lab.onrender.com` o simile. Il browser
chiederà utente e password al primo accesso.

### Il disco non è opzionale

`render.yaml` prevede un disco da 1 GB montato su `/var/data`, con
`DATA_DIR` che punta lì. Senza, il database SQLite e i PNG delle opere
sparirebbero a ogni riavvio e a ogni nuovo rilascio.

Per questo il piano indicato è **Starter** e non quello gratuito: i dischi
persistenti sul piano gratuito non esistono. Se per i primi test l'invio
delle opere non serve, si può passare a `plan: free` togliendo la sezione
`disk` e lasciando `DATA_DIR` al valore predefinito — l'esperienza funziona
per intero, semplicemente le opere non sopravvivono ai riavvii.

### Attesa al primo accesso

Sul piano gratuito il servizio va in letargo dopo un quarto d'ora di
inattività, e la prima richiesta successiva impiega una trentina di secondi.
Va detto a chi prova, o penserà che sia rotto. Sul piano Starter non succede.

### Se la build riesce ma l'avvio fallisce

`Cannot find module .../dist/index.js` significa che il server non è stato
compilato dove ci si aspetta. Il server usa **esbuild**, non l'emissione di
`tsc`: quest'ultima non riscrive gli alias di `paths` e sposta la radice di
output quando il programma include file fuori da `src`, come il pacchetto
`@kandinsky/schema`. Se qualcuno rimette `tsc` come compilatore, l'avvio
torna a fallire esattamente così.

### Quanto dura un rilascio, e come accorciarlo

Il tempo non se ne va nella compilazione — Vite impiega un paio di secondi.
Se ne va in installazione, cache e trasferimento. Le misure applicate:

| Intervento | Effetto |
|---|---|
| `ELECTRON_SKIP_BINARY_DOWNLOAD=1` | evita 250 MB di binario Electron, inutile sul server |
| `neverBuiltDependencies` in package.json | salta gli script di installazione di Electron |
| `--filter @kandinsky/server... @kandinsky/kiosk...` | non installa affatto il progetto del guscio |
| `CI=true` → niente sourcemap | 2,5 MB in meno da trasferire a ogni rilascio |
| `buildFilter.ignoredPaths` | nessuna ricompilazione per modifiche a documentazione o strumenti |

Dopo il primo rilascio con queste impostazioni la cache va ricostruita una
volta: **il beneficio si vede dal secondo in poi**.

Quello che resta non si può ottimizzare da qui: sul piano gratuito le build
girano su macchine condivise e passano da una coda. Se i rilasci frequenti
diventano un problema quotidiano, il piano Starter è la differenza vera —
tutto il resto sono minuti recuperati ai margini.

### Il modo più rapido di provare non è Render

Per il collaudo dell'esperienza, `pnpm app:dev` apre l'applicazione desktop
in pochi secondi, senza rete e senza attese. Il servizio online serve a far
provare l'esperienza **a distanza**: se stai iterando sul codice, iterare
attraverso un rilascio è la strada più lenta possibile. Vedi
`docs/app-desktop.md`.

### Aggiornare

```bash
git push
```

Render ricompila e ripubblica da solo. I contenuti in `packages/content`
sono file statici: per correggere una didascalia o sostituire una forma
basta modificare il JSON o il PNG e fare push, senza toccare il codice.

## 4. L'e-mail

**Render blocca le porte SMTP in uscita sui piani bassi**, come quasi tutti i
servizi cloud, per impedire l'invio di spam. Se le opere restano in coda con
errori di connessione o timeout, la causa è quella e non la configurazione.

Come accorgersene: `GET /api/queue` mostra `last_error` per ogni opera non
partita. Un `ETIMEDOUT` o un `ECONNREFUSED` verso `mail.kansei-studio.com`
significa porta bloccata.

Tre strade:

1. **Lasciare l'invio disattivato durante i test.** Basta non impostare
   `SMTP_PASS`: le opere si salvano comunque, si vedono con `/api/queue` e
   l'esperienza funziona per intero. Per provare *l'esperienza* è sufficiente,
   ed è quello che consiglio per i primi giri.
2. **Usare un provider transazionale con API HTTP** invece di SMTP: le API
   passano sulla 443, che non è mai bloccata. Richiede di sostituire
   Nodemailer nel `mailer.ts`, una mezz'ora di lavoro.
3. **Chiedere lo sblocco a Render**, che su richiesta motivata a volte lo
   concede sui piani a pagamento.

In sala il problema non si pone: il server gira sulla rete del museo e la
casella è quella dell'istituzione.

## 5. Cosa dire a chi prova

- **Serve un tablet in orizzontale**, o un portatile. Il layout è disegnato a
  1920×1080 e viene scalato per stare a schermo: su un telefono si vede tutto
  ma i controlli diventano minuscoli.
- **L'audio parte al tocco su "Inizia"**, mai prima: è il browser a imporlo.
  Su iPhone e iPad va tolto il silenzioso, altrimenti non si sente nulla.
- **Il puntatore circolare compare solo con il mouse** e sparisce al primo
  tocco: è un aiuto per chi prova da computer, non un elemento dell'interfaccia.

## 6. Prima di aprire l'indirizzo a estranei

- Il consenso e-mail è già formulato per l'adulto, ma durante i test conviene
  **lasciare l'invio disattivato** e non raccogliere indirizzi affatto.
- Se si raccolgono, valgono le note in `docs/privacy.md`: l'indirizzo va
  cancellato dopo l'invio, e serve un titolare del trattamento identificato.
- L'autenticazione di base viaggia in chiaro su `http://`. **Usare sempre
  HTTPS**, che tutti i servizi elencati forniscono in automatico.

## 7. Aggiornare

```bash
git push        # se il servizio è collegato al repository
```

I contenuti in `packages/content` sono serviti come file statici: per correggere
una didascalia o sostituire una forma basta modificare il JSON o il PNG e
ripubblicare, senza ricompilare l'esperienza.
