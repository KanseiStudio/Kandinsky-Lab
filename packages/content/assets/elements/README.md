# Elementi grafici

50 frammenti estratti da cinque opere, ritagliati sul contenuto e ridotti entro
i limiti di `docs/asset-spec.md` (640 px sul lato lungo, ~80 KB medi).

## Stato

**37 attivi** — ritaglio pulito, bordo trasparente.

**13 disattivati** (`enabled: false` in `elements.json`) — il file contiene ancora
il fondo dipinto attorno alla forma, quindi sulla tela apparirebbe come una toppa
rettangolare incollata invece che come una forma. Restano nel repository: basta
rifare il ritaglio, sostituire il PNG e rimettere `enabled: true`.

Elenco dei tredici in `provenance.rightsNote`, che riporta la dicitura
"RITAGLIO DA RIFARE".

## Rigenerare

```bash
python3 tools/import_elementi.py    # ritaglia, riduce, genera elements.json e didactics.json
python3 tools/svg_to_png.py         # verifica che i PNG coincidano con il JSON
```

Il primo script rilegge lo zip degli elementi e il documento delle schede: se
arrivano nuove versioni dei PNG, si rilancia e i dati si riallineano da soli.

## Diritti

Tutti i frammenti hanno `rights: "to-verify"`. Le opere di Kandinsky (m. 1944)
sono in pubblico dominio in Italia, ma **la riproduzione fotografica ad alta
risoluzione può avere diritti propri dell'istituzione** che l'ha prodotta.
Va chiarito con Centre Pompidou e Thyssen-Bornemisza prima della messa in sala.

Due cartelle hanno attribuzione incerta e sono segnalate come tali nel JSON:
"Composizione verticale" (titolo non certificato) e "Small Worlds"
(identificazione non verificata).
