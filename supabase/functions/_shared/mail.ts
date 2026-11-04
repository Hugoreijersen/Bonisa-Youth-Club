// Sending e-mail through MailerSend (sends from Germany and Belgium, see
// docs/beveiliging.md). MAIL_API_URL can point to a fake during tests.
import { env } from "./algemeen.ts";

export type Bijlage = { inhoudBase64: string; bestandsnaam: string; inlineId?: string };

export class MailFout extends Error {}

export async function verstuurMail(mail: {
  aan: string;
  naam: string;
  onderwerp: string;
  html: string;
  tekst: string;
  bijlagen?: Bijlage[];
  // Sender for other mails than the ticket mail (e.g. gifts for bonisa.nl).
  afzender?: { email: string; naam: string; antwoordAan?: string };
}) {
  const van = mail.afzender ?? {
    email: env("MAIL_FROM"),
    naam: env("MAIL_FROM_NAAM", false) || "Katwijkse Jongerenzang",
    antwoordAan: env("MAIL_REPLY_TO", false),
  };
  const url = env("MAIL_API_URL", false) || "https://api.mailersend.com/v1";
  const antwoord = await fetch(`${url}/email`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("MAIL_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: { email: van.email, name: van.naam },
      to: [{ email: mail.aan, name: mail.naam }],
      ...(van.antwoordAan ? { reply_to: { email: van.antwoordAan } } : {}),
      subject: mail.onderwerp,
      html: mail.html,
      text: mail.tekst,
      attachments: (mail.bijlagen ?? []).map((b) => ({
        content: b.inhoudBase64,
        filename: b.bestandsnaam,
        disposition: b.inlineId ? "inline" : "attachment",
        ...(b.inlineId ? { id: b.inlineId } : {}),
      })),
    }),
  });
  if (!antwoord.ok) throw new MailFout(`MailerSend gave ${antwoord.status}`);
}
