// The ticket mail: one QR code per ticket (inline images) and a link to the
// personal ticket page. Sent once per paid order; office can send it again.
import { centNaarEuro, env, log, rpc } from "./algemeen.ts";
import { verstuurMail } from "./mail.ts";
import qrcode from "./vendor/qrcode.mjs";

type Ticketgegevens = {
  order_id: string;
  voornaam: string;
  achternaam: string;
  email: string;
  aantal: number;
  bedrag_cent: number;
  toegang: string;
  evenement: { naam: string; begint_op: string; locatie: string };
  tickets: { volgnummer: number; code: string }[];
};

// The QR code holds only the ticket code, in capitals (smaller QR code).
export function qrGif(code: string): string {
  const qr = qrcode(0, "M");
  qr.addData(code.toUpperCase(), "Alphanumeric");
  qr.make();
  return qr.createDataURL(8, 16); // "data:image/gif;base64,..."
}

export function datumTijd(iso: string) {
  const d = new Date(iso);
  const tz = { timeZone: "Europe/Amsterdam" } as const;
  return {
    datum: new Intl.DateTimeFormat("nl-NL", { ...tz, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d),
    tijd: new Intl.DateTimeFormat("nl-NL", { ...tz, hour: "2-digit", minute: "2-digit" }).format(d),
  };
}

const html = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function maakTicketmail(g: Ticketgegevens, siteUrl: string) {
  const { datum, tijd } = datumTijd(g.evenement.begint_op);
  const link = `${siteUrl}/tickets/mijn/#${g.toegang}`;
  const meervoud = g.aantal === 1 ? "je ticket" : `je ${g.aantal} tickets`;
  const onderwerp = `Je ticket${g.aantal === 1 ? "" : "s"} voor ${g.evenement.naam}`;

  const tickets = g.tickets.map((t) => `
    <tr><td style="padding:16px 0;border-top:1px solid #e5e5e5;text-align:center">
      <img src="cid:ticket${t.volgnummer}" width="232" height="232" alt="QR-code ticket ${t.volgnummer}" style="display:block;margin:0 auto">
      <p style="margin:8px 0 0;font-weight:bold">Ticket ${t.volgnummer} van ${g.aantal}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#666;font-family:monospace">${t.code.toUpperCase()}</p>
    </td></tr>`).join("");

  const inhoud = `<!doctype html><html lang="nl"><body style="margin:0;background:#f5f5f0;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;padding:24px">
<tr><td>
  <h1 style="margin:0 0 12px;font-size:24px;color:#4C8C40">Je bent erbij, ${html(g.voornaam)}!</h1>
  <p style="margin:0 0 12px;line-height:1.5">Hier is ${meervoud} voor <strong>${html(g.evenement.naam)}</strong>.</p>
  <p style="margin:0 0 12px;line-height:1.5">D.V. ${datum}, aanvang ${tijd}<br>${html(g.evenement.locatie)}</p>
  <p style="margin:0 0 16px;line-height:1.5">Laat bij de ingang per persoon één QR-code scannen, op je telefoon of geprint.
  Elke code kan maar één keer gebruikt worden: deel je tickets alleen met wie met je meekomt.</p>
  <p style="margin:0 0 16px"><a href="${link}" style="display:inline-block;background:#4C8C40;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold">Bekijk je tickets online</a></p>
</td></tr>
${tickets}
<tr><td style="padding-top:16px;border-top:1px solid #e5e5e5;font-size:13px;color:#555;line-height:1.5">
  Betaald: € ${centNaarEuro(g.bedrag_cent).replace(".", ",")} voor ${g.aantal} ticket${g.aantal === 1 ? "" : "s"}.<br>
  Vragen? Beantwoord deze mail.<br>Stichting Bonisa · Bonisa Youth Club
</td></tr>
</table></td></tr></table></body></html>`;

  const tekst = [
    `Je bent erbij, ${g.voornaam}!`,
    "",
    `Hier is ${meervoud} voor ${g.evenement.naam}.`,
    `D.V. ${datum}, aanvang ${tijd}, ${g.evenement.locatie}.`,
    "",
    "Laat bij de ingang per persoon één QR-code scannen. Je tickets staan ook online:",
    link,
    "",
    ...g.tickets.map((t) => `Ticket ${t.volgnummer} van ${g.aantal}: ${t.code.toUpperCase()}`),
  ].join("\n");

  const bijlagen = g.tickets.map((t) => ({
    inhoudBase64: qrGif(t.code).split(",")[1],
    bestandsnaam: `ticket-${t.volgnummer}.gif`,
    inlineId: `ticket${t.volgnummer}`,
  }));

  return { onderwerp, html: inhoud, tekst, bijlagen };
}

// Sends the ticket mail if it has not been sent yet. Returns what happened.
export async function verstuurTicketmail(orderId: string, opnieuw = false): Promise<string> {
  const g = await rpc<Ticketgegevens | null>("ticketmail_claim", { p_order_id: orderId, p_opnieuw: opnieuw });
  if (!g) return "niets";
  try {
    const mail = maakTicketmail(g, env("SITE_URL"));
    await verstuurMail({ aan: g.email, naam: `${g.voornaam} ${g.achternaam}`, ...mail });
    await rpc("ticketmail_klaar", { p_order_id: orderId, p_gelukt: true });
    log("ticketmail_verstuurd", { order_id: orderId, opnieuw });
    return "verstuurd";
  } catch (e) {
    await rpc("ticketmail_klaar", { p_order_id: orderId, p_gelukt: false });
    throw e;
  }
}
