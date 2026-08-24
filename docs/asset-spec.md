# Specifica asset grafici

## Elementi (`packages/content/assets/elements/`)

- **Formato**: PNG-24 con canale alpha, senza profilo colore incorporato (sRGB implicito)
- **Risoluzione**: @2x rispetto alla dimensione a schermo. Un cerchio che in sala misura
  256 px va esportato a 512 px. `asset.width/height` nel JSON riporta la misura **nativa**
  del file, il codice divide per due.
- **Dimensione massima**: 768 px sul lato lungo. Oltre, la memoria video di un mini-PC
  con grafica integrata inizia a soffrire con 40 elementi sulla tela.
- **Bordi**: alpha premoltiplicato. Un alone bianco sul bordo si vede subito sopra la
  tela avorio.
- **Nome file**: uguale all'`id` dell'elemento. `circle_concentric_01.png`.
- **Peso**: sotto i 120 KB. Passare tutto da `oxipng -o4` o `pngquant`.

### Elementi ricolorabili (`tintable: true`)

Devono essere **bianco puro su alpha**, senza ombre né sfumature: il filtro RGB di Konva
moltiplica il colore, quindi qualsiasi grigio diventa una versione spenta della tinta.
Se una forma ha bisogno di più colori, non è tintable.

### Ancoraggio

`asset.anchor` è il punto attorno a cui la forma ruota e scala, in coordinate normalizzate.
Il default (0.5, 0.5) va bene per forme simmetriche. Per un arco conviene 0.5 / 0.9 e per
una linea 0.0 / 0.5, altrimenti la rotazione a due dita risulta innaturale.

## Icone interfaccia (`assets/ui/`)

SVG monocromatici, 48×48, tratto 3 px, `currentColor`. Nessun testo dentro l'icona.

## Logo del museo

`assets/ui/museum-logo.png`, PNG con alpha, altezza minima 210 px (finisce nel cartiglio
dell'opera esportata a pixelRatio 3). Versione monocroma scura preferibile.

## Set minimo per il primo test in sala

12 elementi bastano e avanzano: 3 cerchi, 2 triangoli, 2 quadrati, 2 archi, 2 linee,
1 forma organica. Con più di 20 il vassoio richiede scroll e i bambini piccoli smettono
di esplorare oltre la prima schermata.
