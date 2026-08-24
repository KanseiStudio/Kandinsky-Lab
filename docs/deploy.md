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

## 3. Dove pubblicare

Serve un servizio che esegua Node 24 con **disco persistente**: il database
SQLite e i PNG delle opere stanno su file, e su un filesystem effimero
spariscono a ogni riavvio.

| Servizio | Note |
|---|---|
| **Render** | Web Service + Disk da 1 GB montato su `/data`. HTTPS automatico. |
| **Railway** | Volume persistente, deploy da repository Git. |
| **Fly.io** | Volume, più controllo, un po' più di configurazione. |
| **VPS proprio** | Massimo controllo. Serve un reverse proxy per il certificato: con Caddy sono tre righe. |

Variabili d'ambiente da impostare sul servizio:

```
NODE_VERSION=24
PORT=8787                      (molti servizi la impongono: leggerla, non fissarla)
DATA_DIR=/data                 percorso del disco persistente
APP_USER=kandinsky
APP_PASSWORD=...
SMTP_HOST / SMTP_PORT / SMTP_SECURE / SMTP_USER / SMTP_PASS
MAIL_FROM / MUSEUM_NAME / MUSEUM_URL
```

Comandi: build `pnpm install && pnpm build`, avvio `pnpm start`.

## 4. L'e-mail su hosting condiviso

**Molti servizi bloccano le porte SMTP in uscita** (25, 465, 587) per impedire
l'invio di spam. Se le opere restano in coda con errori di connessione, è quello.

Tre strade:

1. Lasciare l'invio disattivato durante i test: le opere si salvano comunque e
   si vedono con `GET /api/queue`. Per la prova dell'esperienza è sufficiente.
2. Usare un provider transazionale con API HTTP invece che SMTP.
3. Chiedere al servizio di sbloccare la porta, cosa che alcuni fanno su richiesta.

In sala il problema non si pone: il server gira sulla rete del museo.

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
