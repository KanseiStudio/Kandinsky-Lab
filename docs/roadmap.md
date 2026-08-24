# Roadmap di produzione

## Fase 1 — Prototipo giocabile (stato attuale + asset)
Serve la libreria grafica per avere qualcosa da mettere davanti a dei bambini veri.
12 elementi, 8 colori, 6 didascalie. Test con 5–6 bambini di età diverse.

Il test va fatto **con l'audio acceso**: la domanda a cui rispondere non è "si
divertono", è "capiscono che stanno suonando". Se un bambino di sette anni non
collega il proprio gesto al suono entro il primo minuto, il mapping va rivisto
prima di andare avanti.

## Fase 2 — Robustezza di sala
Dialogo di conferma a schermo intero, undo unificato, filtro sui titoli, localizzazione
IT/EN, watchdog di sistema, log rotativi. È la fase che decide se l'installazione
sopravvive a un sabato pomeriggio.

## Fase 3 — Consegna e backoffice
Template e-mail definitivo approvato dal museo, **pagina di riascolto** `/opera/:id`,
pagina di monitoraggio (opere oggi, coda, errori SMTP), esportazione statistiche per
la relazione finale.

## Fase 2-bis — Taratura sonora in sala
Da fare in loco con l'allestimento definitivo, non in studio: livello con fonometro,
verifica della cupola direzionale, prova con la sala piena. È la fase che il cliente
non si aspetta e che decide la percezione dell'intera installazione.

## Fase 4 — Estensioni possibili
- **Galleria collettiva**: proiezione a parete con le opere della giornata in
  composizione dinamica, **con le rispettive partiture che suonano a rotazione**.
  Il pezzo che di solito convince la direzione, e con la Score in JSON costa poco.
- **Stampa in sala**: il cartiglio è già dimensionato per A4/A3 a 200 dpi.
- **Modalità laboratorio**: un adulto guida una classe, la card didattica diventa
  a schermo intero e sincronizzata su più tavoli.
- **Set tematici**: il campo `tags` permette di filtrare la libreria per periodo
  (Murnau, Bauhaus, Parigi) e trasformare l'esperienza in tre percorsi diversi.
- **Modalità notte**: la tavolozza Composition X su fondo nero con scala minore
  pentatonica. Stesso codice, carattere completamente diverso. Utile per eventi serali.
