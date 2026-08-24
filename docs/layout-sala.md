# Layout di sala

## Griglia 1920×1080

```
┌──────────────────────────────────────────────────────────────┐
│  KANDINSKY LAB   ●──┬──●───┬────●────┬────────────●───────── │ 140 px
├──────────────┬───────────────────────────────────────────────┤
│  COLORI      │                                               │
│  ● ● ● ●     │                                               │
│  ● ● ● ●     │                                               │
│  PENNELLI    │              T E L A                          │
│  ▣ ▣ ▣ ▣ ▣   │           1476 × 784 px                       │ 784 px
│  FORME       │                                               │
│  ▢ ▢ ▢       │                                               │
│  ▢ ▢ ▢       │                                               │
│  (scroll)    │                                               │
├──────────────┴───────────────────────────────────────────────┤
│         [Annulla] [Duplica] [Togli forma] [Ricomincia]  [HO FINITO] │ 140 px
└──────────────────────────────────────────────────────────────┘
     344 px                    1476 px
```

**Perché una colonna sola.** Con strumenti su entrambi i lati la tela viene
stretta da due parti e il bambino deve attraversare tutto il piano per passare
da un colore a una forma. Su un tavolo orizzontale largo un metro e mezzo quel
percorso lo fa con tutto il braccio, appoggiando il gomito sul vetro e dipingendo
senza volerlo. Tenendo tutto a sinistra la tela guadagna trecento pixel e la mano
resta dove sta.

La testina di lettura è allineata all'artboard, quindi si sposta insieme a lui:
i due valori in `canvas.artboard` governano entrambi.

**La barra superiore contiene solo logotipo e traccia.** La traccia è larga quanto
la tela e non può essere accorciata senza rompere la corrispondenza verticale con
le forme: qualunque comando messo lassù finisce sopra la linea. Per questo "Ho
finito" sta in basso a destra, separato dai comandi distruttivi che stanno al
centro — un pulsante che conclude e uno che cancella non devono essere vicini.

## Orientamento del tavolo

Il layout è **mono-orientato**: presuppone un lato di lettura, quindi il tavolo va
allestito con una seduta o una posizione d'uso chiara sul lato lungo frontale.

Se il museo prevede bambini su entrambi i lati lunghi, va attivato `mirrorToolbars` e
duplicata la barra strumenti ruotata di 180° sul lato opposto. Ma attenzione: i testi
didattici restano leggibili da un lato solo, e la soluzione a due postazioni indipendenti
(due tavoli più piccoli) di solito funziona meglio di un tavolo condiviso contestato.

## Altezza e accessibilità

- Piano a 70–75 cm: raggiungibile da un bambino di 6 anni in piedi e da un adulto seduto.
- Spazio libero sotto il piano per almeno 70 cm di altezza: accesso in carrozzina.
- Fascia dei controlli sempre entro 60 cm dal bordo frontale: oltre, un bambino piccolo
  deve sporgersi sul vetro con la pancia e con il gomito dipinge senza volerlo.

## Illuminazione

Il pannello orizzontale prende tutti i faretti del soffitto. Verificare i riflessi in
posizione definitiva prima di fissare il tavolo: la tela avorio (#F7F3E8) è scelta anche
per questo, un fondo nero renderebbe lo schermo uno specchio.
