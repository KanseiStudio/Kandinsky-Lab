# Progettazione sonora

## La regola che tiene in piedi tutto

Dal deck: *"Non esiste una nota sbagliata: esiste la propria composizione."*

Questa non è una frase di marketing, è il vincolo architetturale da cui discende
tutto il sistema audio. Ogni suono generato — dal tocco, dal tratto, dalla forma
posata — passa da `audio/theory.ts` e viene quantizzato a **una sola scala** e a
**una sola griglia ritmica**. Il bambino non può produrre una dissonanza perché le
note fuori scala non esistono nel motore.

Default: **Re maggiore pentatonica, 72 BPM, ciclo di 4 battute**. La pentatonica
non ha semitoni conflittuali: qualunque combinazione di gradi resta consonante,
anche sovrapponendo otto strati generati in momenti diversi.

## La tela è la partitura

Una testina attraversa l'artboard da sinistra a destra a ogni ciclo, e ogni forma
suona quando viene incontrata. Non è una metafora aggiunta: Kandinsky scrive in
*Punkt und Linie zu Fläche* che il piano pittorico ha una direzione di lettura e
una tensione temporale. Qui quella affermazione diventa letterale.

| dimensione visiva | dimensione musicale |
|---|---|
| posizione X | quando suona nel ciclo |
| posizione Y | altezza della nota |
| dimensione | durata e intensità |
| colore | timbro |
| forma | articolazione |
| rotazione | direzione dell'arpeggio |

La conseguenza che conta: **spostare una forma cambia la musica**. Prima trascinare
un cerchio a destra non produceva nulla, ed era il gesto centrale dell'esperienza.

Il suono immediato al drop resta: senza, la testina è un'attesa incomprensibile;
senza la testina, il suono immediato è un giocattolo. Servono entrambi.

### Dove sta l'indicatore

Nella **barra superiore**, non sopra la tela. Tre motivi: non copre il disegno del
bambino, non va nascosto al momento dell'export, e quella fascia era spazio
inutilizzato fra il logotipo e "Ho finito".

Vincolo non negoziabile: la traccia è allineata **esattamente** all'ampiezza
dell'artboard (`canvas.artboard.x` e `.width`), non alla larghezza dello schermo.
Se le due scale divergono, la corrispondenza verticale fra indicatore e forma
sottostante si perde e il meccanismo smette di essere leggibile. Chi cambierà il
layout deve sapere che queste due misure sono legate.

A compensare l'assenza della linea sul disegno, **la forma pulsa quando suona**.
È un feedback migliore di una linea che passa: dice *quale* forma sta suonando,
non solo *dove* siamo nel ciclo.

## Colore × forma

Il sistema si regge su una moltiplicazione, non su una tabella:

| | decide | dove sta |
|---|---|---|
| **Colore** | il timbro e il registro — *come* suona | `palettes.json`, campo `sound` di ogni swatch |
| **Forma** | il ruolo musicale — *cosa* fa nel tempo | `elements.json`, campo `sound` di ogni elemento |

Otto colori × dodici forme = novantasei comportamenti sonori distinti da una
manciata di righe di dati. Aggiungere una forma significa aggiungere otto nuovi
suoni senza scrivere codice.

### Timbri disponibili

`pluck` `bell` `pad` `reed` `brass` `bow` `mallet` `noise` `sub`

Sono nove synth costruiti una volta all'avvio e riusati. Creare synth a runtime è
il modo più rapido per accumulare nodi Web Audio fino al crash dopo qualche ora di
apertura.

### Ruoli musicali

`drone` `pad` `accent` `pulse` `sequence` `sweep` `texture` `chord`

Il ruolo definisce durata, ricorrenza e comportamento: un `pulse` rientra ogni
battuta, un `drone` ogni quattro, un `accent` è un colpo secco, una `sequence` è
una frase di quattro note che sale sui gradi della scala.

## Le associazioni sono contenuto, non codice

Il mapping colore → timbro sta nel JSON e va **validato dal curatore**, esattamente
come le didascalie. Il riferimento è la sinestesia che Kandinsky descrive in
*Über das Geistige in der Kunst* — il giallo che squilla come una tromba, il blu
profondo come un violoncello, il verde immobile e senza tensione — ma resta
un'interpretazione storica di una teoria, non una verità da incidere nel software.

Nel JSON ogni swatch ha un campo `note` che spiega la scelta: serve al curatore per
discuterla e, se vuole, ribaltarla.

## La musica cresce, poi si trasforma

Il deck dice "ogni nuovo colore o forma aggiunge un livello". Preso alla lettera,
dopo quaranta forme si ottiene un muro di suono in cui non si distingue più nulla.

La soluzione implementata in `composer.ts`: superato `maxVoices` (default 7), lo
strato più vecchio viene abbassato in tre secondi e ritirato. Il risultato è che la
musica **continua a cambiare** mentre il bambino compone, invece di ispessirsi.
Il quadro cresce, la musica si trasforma.

I gradi dei nuovi strati vengono scelti evitando quelli già occupati, così
l'arrangiamento si apre in armonia invece di raddoppiare sempre la tonica.

## Il gesto pittorico

Un dito su un pannello a 120 Hz produce centinaia di eventi al secondo. Il throttle
in `paintVoice.ts` è la parte più importante di quel file: senza, il risultato è una
mitragliata e con quattro bambini contemporanei il motore audio si pianta.

Mappatura scelta: **l'altezza della nota dipende dalla posizione verticale del dito**.
In alto acuto, in basso grave. È l'unica che i bambini scoprono da soli in pochi
secondi, senza istruzioni. La velocità del gesto controlla l'intensità.

## La partitura invece del file audio

L'e-mail **non allega audio**. Allega l'immagine e linka una pagina di riascolto.

Quello che viene salvato è la `Score`: un JSON di 1–3 KB che descrive gli strati,
i gradi, i timbri e le note del tratto. Il browser del genitore la ricostruisce con
lo stesso motore usato in sala.

Perché conta:

- **peso**: 2 KB invece di 4–8 MB per opera. Con 300 visite al giorno la differenza
  fra un server che regge e uno che va sostituito.
- **niente rendering offline**: `Tone.Offline` su un mini-PC museale, mentre altri
  bambini stanno dipingendo, è latenza garantita nel momento peggiore.
- **riproducibilità**: la stessa partitura suona identica su qualsiasi browser, oggi
  e fra tre anni.
- **il link è condivisibile**: e questo, per il museo, vale più dell'allegato.

Endpoint: `GET /api/artworks/:sessionId/score`. Restituisce solo dati anonimi —
titolo, partitura, disposizione. Nessun indirizzo, nessun riferimento a persone.

## Il problema serio: l'audio in sala

È il rischio più concreto dell'intero progetto e va affrontato con il museo **prima**
della produzione, non in fase di collaudo.

Otto ore al giorno di musica generativa in una galleria disturbano tutto ciò che sta
intorno. Se il personale di sala può abbassare il volume, entro il secondo giorno lo
porta a zero, e a quel punto metà del concept non esiste più.

Tre strade, in ordine di efficacia:

1. **Cupola sonora direzionale** sopra la postazione (Panphonics, Brown Innovations,
   Holosonics). Il suono esiste solo sotto la cupola, fuori è quasi silenzio. È la
   soluzione corretta per un museo e va messa a preventivo, non aggiunta dopo.
2. **Cuffie** in postazione. Costano poco ma introducono igiene, manutenzione e cavi,
   e su bambini piccoli con un adulto accanto funzionano meno bene di quanto sembri.
3. **Diffusori in postazione a volume basso**, con `fadeOutAfterSec` aggressivo.
   Accettabile solo in una sala dedicata o in un'aula didattica.

Nel codice sono già presenti: limiter sul master, tetto software al volume non
superabile dall'interfaccia (`audio.maxGain`), e dissolvenza automatica dopo 45
secondi di inattività. Il resto è allestimento.

## Movimento armonico

Una pentatonica statica non risolve mai: è il motivo per cui quasi tutto il
generativo suona uguale a sé stesso dopo trenta secondi.

Sotto la composizione scorre una progressione lenta — quattro accordi da quattro
battute, definiti in `sound.json` — e i gradi degli elementi diventano **relativi
alla radice corrente**. Con `loopBars: 4` la testina compie quattro passaggi completi
prima che il ciclo armonico si chiuda: il bambino ripercorre la stessa tela quattro
volte e la sente cambiare. È l'unico modo per ottenere variazione senza chiedergli
di aggiungere elementi.

Gli accordi non sono cifrati: `root` è un grado della scala. Restiamo dentro la
stessa promessa di consonanza, spostando il centro di gravità.

A ogni cambio scende una nota di basso. Non è decorativa: senza un fondo che si
muove, il cambio d'accordo si percepisce come uno scarto invece che come un
movimento.

La linea di base della traccia in barra cambia colore a ogni accordo, usando i
colori della tavolozza in uso. Il bambino non deve capire cosa sia una progressione,
ma vede che qualcosa cambia quando la musica cambia — e l'informazione resta dentro
il linguaggio dell'opera.

## La coda finale

Alla pressione di "Ho finito" il ciclo non prosegue. La chiusura ha tre tempi:

1. **Ultimo passaggio completo** della testina. Tagliarlo a metà si sente come errore.
2. **Ritiro degli strati** in dissolvenza mentre la corsa finisce.
3. **Risoluzione sulla tonica**, fuori dalla progressione, con coda di riverbero.

Durata tipica venti-trenta secondi, regolabile in `sound.finale`. L'opera resta a
schermo per tutta la durata, così il finale non viene tagliato da un tocco impaziente.

## Costruzione del timbro

Nella prima versione ogni nota era una sola onda, e suonava esattamente per
quello che era: un segnale di prova. Il timbro riconoscibile nasce da tre cose
che mancavano tutte e tre.

**Impilamento armonico.** Ogni nota fa suonare anche i propri armonici — ottava,
quinta, dodicesima — a volumi decrescenti, definiti per timbro in `voices.ts`.
La campana ha armonici inarmonici, che è ciò che la rende metallica; il tappeto
ha la quinta a peso alto, che è ciò che lo fa percepire come tappeto e non come
nota tenuta. Gli armonici entrano qualche millisecondo dopo la fondamentale:
un attacco perfettamente simultaneo suona elettronico.

**Filtro pilotato dalla dinamica.** Ogni timbro ha un filtro passa-basso la cui
apertura segue l'intensità della nota. Su uno strumento vero il colore cambia
con la forza del gesto; su un synth a volume variabile ma spettro fisso no, ed
è la ragione principale per cui un suono sintetico si riconosce come tale.
Gli ottoni hanno l'escursione più ampia (600–5600 Hz), ed è il loro tratto.

**Scordamento.** Due o tre oscillatori a pochi centesimi di distanza per timbro,
più uno scarto casuale sugli armonici. Il battimento che ne risulta dà corpo e
movimento a note che altrimenti restano immobili.

### Catena master

`master → chorus → EQ3 → compressore → limiter`

- **chorus** appena accennato (wet 0,18): allarga il fronte stereo senza sentirsi
- **EQ3** toglie il fango sotto i 220 Hz e la durezza sopra i 6 kHz, che su
  diffusori piccoli da chiosco è quanto basta
- **compressore** lento lega fra loro strati che entrano in momenti diversi:
  senza, ogni nuova forma salta fuori dal mix
- **limiter** ultimo, come rete di sicurezza

### Un solo punto di esecuzione

`AudioEngine.play()` e `playChord()` sono gli unici modi di produrre suono.
Chiamare i synth direttamente aggirerebbe impilamento, filtro e panning, e
riporterebbe il timbro alle onde singole della prima versione.

## Panning

Il panner è per **timbro**, non per nota. Limite noto e accettato: le note dello
stesso timbro condividono il panner, quindi la coda di una nota si sposta se ne
parte un'altra da una posizione diversa. Un panner per nota richiederebbe un synth
per nota, che è esattamente ciò che fa saturare i nodi Web Audio dopo qualche ora
di apertura. Con timbri distinti per colore l'effetto è impercettibile.

## Ancora da fare

1. **Slot di frequenza** invece del solo conteggio voci: un basso alla volta, massimo
   tre nel medio, acuti liberi. È così che si evita il fango, non limitando il totale.
2. **Riverbero a convoluzione** con un impulso reale di sala. Un file da 200 KB, e il
   suono passa da "plugin" a "ambiente". È il prossimo salto di qualità più netto.
3. **Campioni reali** al posto della sintesi, via `Tone.Sampler`: tre o quattro note
   per timbro e l'interpolazione fa il resto. Porta la resa a un altro livello ma
   aggiunge qualche megabyte di asset e una questione di licenze da chiarire.
3. **Pagina di riascolto** `/opera/:id`: la partitura contiene già progressione e
   posizioni, quindi la ricostruzione è fedele.

## Da definire con il museo

- Tonalità e tempo: 72 BPM in Re è una scelta neutra, ma se la mostra ha già una
  identità sonora conviene allinearsi.
- Se la palette "Notte" (Composition X, fondo nero) diventa una modalità serale
  con scala minore pentatonica, l'esperienza cambia carattere senza toccare il codice.
- Se l'audio va disattivato in certe fasce orarie: basta `sound.enabled: false`,
  e l'esperienza visiva resta completa.
