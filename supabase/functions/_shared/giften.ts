// Gifts for bonisa.nl: Mollie calls with the gift key, processing payments,
// starting and stopping monthly gifts, and the thank-you mail.
// Explanation in Dutch: docs/giften.md
import {
  bedragInEuro, centNaarEuro, env, euroNaarCent, log, type MollieBetaling, MollieFout, mollieVerzoek, rpc,
} from "./algemeen.ts";
import { verstuurMail } from "./mail.ts";
import { aanmeldenNieuwsbrief } from "./nieuwsbrief.ts";

// Gifts use their own Mollie website profile, so their own key (besluit 39).
const sleutel = () => env("MOLLIE_GIFTEN_API_KEY");
export const giftenSite = () => env("GIFTEN_SITE_URL").replace(/\/$/, "");

function webhookUrl(): string {
  const functies = env("PUBLIC_FUNCTIONS_URL", false);
  // Without a public address (local development) Mollie cannot call us; the
  // thank-you page then checks the status itself (see giftinfo).
  return functies ? `${functies}/gift-webhook?forceFunctionRegion=eu-central-1` : "";
}

// --- Projects ---------------------------------------------------------------
// The list that office keeps in Pages CMS (site/_data/projecten.json), as
// published by the website at /geven/projecten.json. Only open projects can
// receive gifts. Kept for one minute, so not every gift fetches it.
export type Project = { slug: string; naam: string; open: boolean };
let projectenCache: { tijd: number; projecten: Project[] } | null = null;

export async function zoekProject(slug: string): Promise<Project | null> {
  if (!projectenCache || Date.now() - projectenCache.tijd > 60_000) {
    const url = env("PROJECTEN_URL", false) || `${giftenSite()}/geven/projecten.json`;
    const antwoord = await fetch(url, { headers: { Accept: "application/json" } });
    if (!antwoord.ok) throw new Error(`Project list gave ${antwoord.status}`);
    const data = await antwoord.json();
    projectenCache = { tijd: Date.now(), projecten: Array.isArray(data?.projecten) ? data.projecten : [] };
  }
  return projectenCache.projecten.find((p) => p.slug === slug && p.open === true) ?? null;
}

// --- Mollie -----------------------------------------------------------------
export function maakKlant(periodiekId: string, naam: string, email: string) {
  return mollieVerzoek<{ id: string }>("/customers", {
    method: "POST",
    headers: { "Idempotency-Key": `klant-${periodiekId}` },
    body: JSON.stringify({ name: naam, email, locale: "nl_NL", metadata: { periodiek_id: periodiekId } }),
  }, sleutel());
}

// customerId given: first payment of a monthly gift (creates the mandate).
export function maakGiftBetaling(g: { bedragCent: number; omschrijving: string; giftId: string; customerId?: string }) {
  const webhook = webhookUrl();
  return mollieVerzoek<MollieBetaling>("/payments", {
    method: "POST",
    headers: { "Idempotency-Key": g.giftId },
    body: JSON.stringify({
      amount: { currency: "EUR", value: centNaarEuro(g.bedragCent) },
      description: g.omschrijving,
      redirectUrl: `${giftenSite()}/geven/bedankt/?gift=${g.giftId}`,
      ...(webhook ? { webhookUrl: webhook } : {}),
      locale: "nl_NL",
      metadata: { gift_id: g.giftId },
      ...(g.customerId ? { customerId: g.customerId, sequenceType: "first" } : {}),
    }),
  }, sleutel());
}

function haalGiftBetaling(id: string) {
  return mollieVerzoek<MollieBetaling>(`/payments/${encodeURIComponent(id)}`, {}, sleutel());
}

// Cancel a subscription. Already cancelled or gone also counts as cancelled.
async function annuleerAbonnement(customerId: string, subscriptionId: string) {
  try {
    await mollieVerzoek(`/customers/${encodeURIComponent(customerId)}/subscriptions/${encodeURIComponent(subscriptionId)}`,
      { method: "DELETE" }, sleutel());
  } catch (e) {
    if (e instanceof MollieFout && [404, 410, 422].includes(e.status)) return;
    throw e;
  }
}

// --- Processing a payment ---------------------------------------------------
type Verwerkt = { resultaat: string; status?: string; gift_id?: string; soort?: string; periodiek_id?: string | null };

// Used by the webhook and, as a backup, by the thank-you page (giftinfo).
export async function verwerkGiftBetaling(paymentId: string): Promise<Verwerkt> {
  // Never trust the caller: always ask Mollie itself.
  const b = await haalGiftBetaling(paymentId);
  const resultaat = await rpc<Verwerkt>("verwerk_gift_betaling", {
    p_payment_id: b.id,
    p_mollie_status: b.status,
    p_bedrag_cent: bedragInEuro(b.amount),
    p_terugbetaald_cent: euroNaarCent(b.amountRefunded?.value) + euroNaarCent(b.amountChargedBack?.value),
    p_subscription_id: b.subscriptionId ?? null,
    p_mandate_id: b.mandateId ?? null,
  });
  if (resultaat.status === "betaald" && resultaat.gift_id) {
    await naGift(resultaat.gift_id, resultaat.periodiek_id ?? null);
  }
  return resultaat;
}

// After payment: start the monthly gift, thank-you mail, newsletter. All
// three are safe to run again. An error is thrown on, so the webhook answers
// 500 and Mollie tries again later.
async function naGift(giftId: string, periodiekId: string | null) {
  const stappen: [string, () => Promise<unknown>][] = [
    ["abonnement", () => (periodiekId ? startAbonnement(periodiekId) : Promise.resolve("geen"))],
    ["giftmail", () => verstuurGiftmail(giftId)],
    ["nieuwsbrief", () => aanmeldenNieuwsbrief(giftId,
      { claim: "gift_nieuwsbrief_claim", mislukt: "gift_nieuwsbrief_mislukt", parameter: "p_gift_id" })],
  ];
  const fouten: string[] = [];
  for (const [taak, stap] of stappen) {
    try {
      await stap();
    } catch (e) {
      log(`${taak}_fout`, { gift_id: giftId, fout: String(e) });
      fouten.push(taak);
    }
  }
  if (fouten.length) throw new Error(`na_gift_mislukt: ${fouten.join(", ")}`);
}

// "2026-11-04" -> "2026-12-04"; 31 January -> 28/29 February.
export function volgendeMaand(vandaag: string): string {
  const [j, m, d] = vandaag.split("-").map(Number);
  const jaar = m === 12 ? j + 1 : j;
  const maand = m === 12 ? 1 : m + 1;
  const dagen = new Date(Date.UTC(jaar, maand, 0)).getUTCDate();
  return `${jaar}-${String(maand).padStart(2, "0")}-${String(Math.min(d, dagen)).padStart(2, "0")}`;
}

const vandaagAmsterdam = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(new Date());

// The first month is paid with iDEAL; Mollie collects the next one a month
// later, and then every month, with the mandate from that first payment.
async function startAbonnement(periodiekId: string): Promise<string> {
  const p = await rpc<{ periodiek_id: string; customer_id: string; mandate_id: string | null;
    bedrag_cent: number; project_naam: string } | null>("periodiek_klaar_voor_start", { p_periodiek_id: periodiekId });
  if (!p) return "niets";

  const webhook = webhookUrl();
  const abonnement = await mollieVerzoek<{ id: string }>(
    `/customers/${encodeURIComponent(p.customer_id)}/subscriptions`, {
      method: "POST",
      headers: { "Idempotency-Key": `abonnement-${p.periodiek_id}` },
      body: JSON.stringify({
        amount: { currency: "EUR", value: centNaarEuro(p.bedrag_cent) },
        interval: "1 month",
        startDate: volgendeMaand(vandaagAmsterdam()),
        description: `Maandelijkse gift ${p.project_naam}`.slice(0, 250),
        ...(p.mandate_id ? { mandateId: p.mandate_id } : {}),
        ...(webhook ? { webhookUrl: webhook } : {}),
        metadata: { periodiek_id: p.periodiek_id },
      }),
    }, sleutel());

  const gelukt = await rpc<boolean>("periodiek_gestart", { p_periodiek_id: p.periodiek_id, p_subscription_id: abonnement.id });
  if (!gelukt) {
    // Stopped by the giver while we were starting it: cancel it again.
    await annuleerAbonnement(p.customer_id, abonnement.id);
    log("abonnement_direct_gestopt", { periodiek_id: p.periodiek_id });
    return "gestopt";
  }
  log("abonnement_gestart", { periodiek_id: p.periodiek_id, subscription_id: abonnement.id });
  return "gestart";
}

// --- Stopping a monthly gift ------------------------------------------------
type VoorStoppen = { periodiek_id: string; status: string; customer_id: string | null; subscription_id: string | null };

// Either the stop code from the mail (giver) or the id (office).
// Returns: gestopt | al_gestopt | niet_actief | onbekend
export async function stopPeriodiek(wie: { stopcode?: string; id?: string }, door: "gever" | "kantoor") {
  const zoek = () => rpc<VoorStoppen | null>("periodiek_voor_stoppen",
    { p_stopcode: wie.stopcode ?? null, p_id: wie.id ?? null });
  const p = await zoek();
  if (!p) return "onbekend";
  if (p.status === "mislukt") return "niet_actief";

  // First stop it in the database, so it can no longer be started; then
  // cancel at Mollie. Running this again is safe (also after an error).
  await rpc("periodiek_gestopt", { p_periodiek_id: p.periodiek_id, p_door: door });
  const nu = await zoek();
  if (nu?.customer_id && nu.subscription_id) await annuleerAbonnement(nu.customer_id, nu.subscription_id);
  log("periodiek_gestopt", { periodiek_id: p.periodiek_id, door });
  return p.status === "gestopt" ? "al_gestopt" : "gestopt";
}

// --- Thank-you mail ---------------------------------------------------------
type Giftgegevens = {
  gift_id: string;
  soort: "eenmalig" | "eerste";
  voornaam: string;
  achternaam: string;
  email: string;
  bedrag_cent: number;
  project_naam: string;
  stopcode: string | null;
};

const html = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const euro = (cent: number) => `€ ${centNaarEuro(cent).replace(".", ",")}`;

export function maakGiftmail(g: Giftgegevens, siteUrl: string) {
  const maandelijks = g.soort === "eerste";
  const stoplink = maandelijks && g.stopcode ? `${siteUrl}/geven/stoppen/#${g.stopcode}` : "";
  const onderwerp = maandelijks
    ? `Bedankt voor uw maandelijkse gift voor ${g.project_naam}`
    : `Bedankt voor uw gift voor ${g.project_naam}`;

  const alineas = maandelijks
    ? [
      `Uw maandelijkse gift van <strong>${euro(g.bedrag_cent)}</strong> voor <strong>${html(g.project_naam)}</strong> is gestart. De eerste gift hebben we ontvangen.`,
      "Vanaf volgende maand wordt het bedrag elke maand automatisch afgeschreven (via Mollie). U ziet het op uw afschrift als incasso.",
      "Wilt u stoppen? Dat kan altijd, met één klik op de knop hieronder. Bewaar deze mail daarom goed.",
    ]
    : [
      `Uw gift van <strong>${euro(g.bedrag_cent)}</strong> voor <strong>${html(g.project_naam)}</strong> is goed ontvangen.`,
    ];

  const inhoud = `<!doctype html><html lang="nl"><body style="margin:0;background:#f5f5f0;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;padding:24px">
<tr><td>
  <h1 style="margin:0 0 12px;font-size:24px;color:#4d8b2c">Hartelijk dank, ${html(g.voornaam)}!</h1>
  ${alineas.map((a) => `<p style="margin:0 0 12px;line-height:1.5">${a}</p>`).join("\n  ")}
  ${stoplink ? `<p style="margin:0 0 16px"><a href="${stoplink}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold">Maandelijkse gift stoppen</a></p>` : ""}
  <p style="margin:0 0 12px;line-height:1.5">Hartelijk dank voor uw steun.</p>
</td></tr>
<tr><td style="padding-top:16px;border-top:1px solid #e5e5e5;font-size:13px;color:#555;line-height:1.5">
  Vragen? Beantwoord deze mail.<br>Stichting Bonisa
</td></tr>
</table></td></tr></table></body></html>`;

  const tekst = [
    `Hartelijk dank, ${g.voornaam}!`,
    "",
    ...(maandelijks
      ? [
        `Uw maandelijkse gift van ${euro(g.bedrag_cent)} voor ${g.project_naam} is gestart. De eerste gift hebben we ontvangen.`,
        "Vanaf volgende maand wordt het bedrag elke maand automatisch afgeschreven (via Mollie).",
        "",
        "Stoppen kan altijd via deze link:",
        stoplink,
      ]
      : [`Uw gift van ${euro(g.bedrag_cent)} voor ${g.project_naam} is goed ontvangen.`]),
    "",
    "Hartelijk dank voor uw steun.",
    "Stichting Bonisa",
  ].join("\n");

  return { onderwerp, html: inhoud, tekst };
}

export async function verstuurGiftmail(giftId: string): Promise<string> {
  const g = await rpc<Giftgegevens | null>("giftmail_claim", { p_gift_id: giftId });
  if (!g) return "niets";
  try {
    const mail = maakGiftmail(g, giftenSite());
    await verstuurMail({
      aan: g.email,
      naam: `${g.voornaam} ${g.achternaam}`,
      ...mail,
      afzender: {
        email: env("GIFTEN_MAIL_FROM"),
        naam: env("GIFTEN_MAIL_FROM_NAAM", false) || "Stichting Bonisa",
        antwoordAan: env("GIFTEN_MAIL_REPLY_TO", false),
      },
    });
    await rpc("giftmail_klaar", { p_gift_id: giftId, p_gelukt: true });
    log("giftmail_verstuurd", { gift_id: giftId });
    return "verstuurd";
  } catch (e) {
    await rpc("giftmail_klaar", { p_gift_id: giftId, p_gelukt: false });
    throw e;
  }
}
