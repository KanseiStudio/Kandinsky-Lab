import nodemailer from "nodemailer";
import { readFile } from "node:fs/promises";

export interface MailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  museumName: string;
  museumUrl: string;
}

export function createMailer(cfg: MailConfig) {
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
    pool: true,
    maxConnections: 2,
    rateDelta: 60_000,
    rateLimit: 30, // i provider SMTP dei musei hanno limiti bassi
  });

  return {
    async send(to: string, title: string, imagePath: string, listenUrl?: string) {
      const image = await readFile(imagePath);
      await transport.sendMail({
        from: cfg.from,
        to,
        subject: `La tua opera Kandinsky Lab: ${title}`,
        text: [
          `Hai creato qualcosa che prima non esisteva.`,
          ``,
          `"${title}"`,
          ``,
          `Grazie per aver partecipato a Kandinsky Lab presso ${cfg.museumName}.`,
          `In allegato trovi la tua opera digitale.`,
          ``,
          listenUrl ? `Ascolta la musica della tua opera: ${listenUrl}` : "",
          ``,
          `Continua a giocare con colori, forme e immaginazione.`,
          cfg.museumUrl,
        ].join("\n"),
        html: renderHtml(title, cfg, listenUrl),
        attachments: [
          { filename: `${slug(title)}.png`, content: image, cid: "artwork" },
        ],
      });
    },
    verify: () => transport.verify(),
  };
}

function renderHtml(title: string, cfg: MailConfig, listenUrl?: string) {
  return `
<div style="font-family:Georgia,serif;max-width:640px;margin:0 auto;padding:40px 24px;color:#141414">
  <p style="font-size:22px;line-height:1.4;margin:0 0 28px">Hai creato qualcosa che prima non esisteva.</p>
  <img src="cid:artwork" alt="${escapeHtml(title)}" style="width:100%;border:3px solid #141414" />
  <p style="font-size:26px;font-weight:700;margin:24px 0 4px">${escapeHtml(title)}</p>
  <p style="font-size:14px;color:#5A5347;margin:0 0 32px">creata con Kandinsky Lab · ${escapeHtml(cfg.museumName)}</p>
  ${listenUrl
    ? `<p style="margin:0 0 28px"><a href="${listenUrl}" style="display:inline-block;background:#1B3A93;color:#fff;padding:14px 28px;text-decoration:none;font-size:16px">Ascolta la musica della tua opera</a></p>`
    : ""}
  <p style="font-size:16px;line-height:1.6">Continua a giocare con colori, forme e immaginazione.</p>
  <p style="font-size:14px;color:#5A5347;margin-top:40px">
    Questo indirizzo è stato usato solo per inviarti il disegno e viene cancellato dopo l'invio.
    <br /><a href="${cfg.museumUrl}" style="color:#1B3A93">${escapeHtml(cfg.museumName)}</a>
  </p>
</div>`;
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "opera";
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
