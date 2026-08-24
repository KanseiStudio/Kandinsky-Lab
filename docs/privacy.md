# Note privacy — Kandinsky Lab

Documento tecnico di supporto. Non sostituisce l'informativa, che va redatta dal
titolare del trattamento (il museo) sulla base del progetto effettivo.

## Dati trattati

| Dato | Quando | Base giuridica | Conservazione |
|---|---|---|---|
| Immagine dell'opera | sempre | interesse legittimo / esecuzione del servizio | configurabile, default 30 giorni |
| Statistiche anonime di sessione | sempre | interesse legittimo | indefinita, non riconducibili |
| Indirizzo e-mail dell'adulto | solo se richiesto l'invio | consenso esplicito | cancellato dopo l'invio (default 60 min) |
| Titolo scelto dal bambino | sempre | — | con l'immagine |

Non si raccoglie il nome dell'autore. Non si raccolgono immagini del visitatore.
Non c'è tracciamento fra sessioni: ogni sessione ha un UUID generato in locale e
non persistito sul chiosco.

## Punti di attenzione specifici

- **L'e-mail è dell'adulto, non del bambino.** La schermata lo dice esplicitamente.
  È il punto in cui l'installazione è più esposta: va presidiato dal testo a schermo
  e, se possibile, dal personale di sala.
- **Nessun uso secondario.** L'indirizzo non finisce in newsletter, CRM o liste.
  Il codice non ha alcun percorso che lo esporti.
- **Cancellazione su richiesta** (art. 17): endpoint `DELETE /api/artworks/:sessionId`.
  Il session id è nel nome del file allegato alla mail, quindi un genitore che scrive
  al museo è identificabile senza domande ulteriori.
- **Il server sta in rete locale del museo.** Se viene esposto su internet servono
  TLS, autenticazione sull'endpoint di cancellazione e una valutazione aggiuntiva.
- **Fornitore SMTP**: se è un servizio esterno (es. un provider transazionale) va
  inserito fra i responsabili del trattamento con relativo DPA.

## Da definire con il titolare

- Periodo di conservazione delle immagini e finalità (documentazione? rendicontazione
  di un bando? social del museo? quest'ultima richiederebbe una base giuridica diversa)
- Chi è l'amministratore di sistema del mini-PC e del server
- Procedura in caso di data breach sul chiosco
