/**
 * Identificativo di sessione.
 *
 * `crypto.randomUUID()` esiste solo in contesto sicuro: su localhost sì,
 * ma su un indirizzo http:// qualsiasi — un IP di rete locale, un dominio
 * di prova senza certificato — è `undefined`. L'applicazione andrebbe in
 * errore all'avvio, prima ancora di mostrare la schermata di benvenuto.
 *
 * È il difetto classico che non si vede mai in sviluppo e si manifesta al
 * primo test fuori dalla propria macchina.
 */
export function sessionId(): string {
  const c = globalThis.crypto as Crypto | undefined;

  if (c?.randomUUID) return c.randomUUID();

  if (c?.getRandomValues) {
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; // versione 4
    b[8] = (b[8] & 0x3f) | 0x80; // variante RFC 4122
    const hex = [...b].map((n) => n.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Ultima risorsa: non crittograficamente sicuro, ma qui l'id serve solo
  // a distinguere le opere fra loro, non a proteggere nulla.
  const r = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
  return `${r()}${r()}-${r()}-4${r().slice(1)}-a${r().slice(1)}-${r()}${r()}${r()}`;
}
