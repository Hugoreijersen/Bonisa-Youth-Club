// create-order: saves an order and starts a Mollie payment.
//
// Accepts a normal form post (works without JavaScript: answers with a
// redirect) or JSON from the order page (answers with JSON).
// The amount is computed in the database from the event price, never taken
// from the form.
import {
  corsHeaders, DatabaseFout, doorsturen, env, json, log, maakBetaling, rpc,
} from "../_shared/algemeen.ts";

const MELDINGEN: Record<string, string> = {
  onbekend_evenement: "Dit evenement bestaat niet.",
  verkoop_gesloten: "De ticketverkoop is op dit moment gesloten.",
  ongeldig_aantal: "Kies een geldig aantal tickets.",
  niet_genoeg_plaatsen: "Er zijn niet genoeg tickets meer beschikbaar.",
  te_veel_bestellingen: "Je hebt het afgelopen uur al vaak besteld. Probeer het later opnieuw.",
  ongeldige_gegevens: "Niet alle verplichte velden zijn goed ingevuld.",
  geen_akkoord: "Ga akkoord met de voorwaarden en de privacyverklaring.",
  betaling_mislukt: "Het betalen kon niet worden gestart. Probeer het opnieuw.",
  fout: "Er ging iets mis. Probeer het opnieuw.",
};

type Formulier = Record<string, string>;

async function leesFormulier(req: Request): Promise<{ velden: Formulier; wilJson: boolean }> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const data = await req.json();
    const velden: Formulier = {};
    for (const [k, v] of Object.entries(data ?? {})) velden[k] = String(v ?? "");
    return { velden, wilJson: true };
  }
  const form = await req.formData();
  const velden: Formulier = {};
  for (const [k, v] of form.entries()) velden[k] = typeof v === "string" ? v : "";
  return { velden, wilJson: false };
}

function controleer(v: Formulier): string | null {
  const tekst = (naam: string, max: number, verplicht = true) => {
    const w = (v[naam] ?? "").trim();
    return (!verplicht || w.length > 0) && w.length <= max;
  };
  if (!tekst("voornaam", 100) || !tekst("achternaam", 100) || !tekst("woonplaats", 100)) return "ongeldige_gegevens";
  if (!tekst("telefoon", 30, false)) return "ongeldige_gegevens";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((v.email ?? "").trim()) || v.email.length > 254) return "ongeldige_gegevens";
  if (!/^\d{1,2}$/.test(v.aantal ?? "")) return "ongeldig_aantal";
  if (!["on", "true", "1", "ja"].includes((v.akkoord ?? "").toLowerCase())) return "geen_akkoord";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { fout: "methode" }, 405);

  const siteUrl = env("SITE_URL");
  let wilJson = false;

  const fout = (code: string, status = 400) =>
    wilJson
      ? json(req, { fout: code, melding: MELDINGEN[code] ?? MELDINGEN.fout }, status)
      : doorsturen(`${siteUrl}/tickets/?fout=${code}`);

  try {
    const gelezen = await leesFormulier(req);
    const v = gelezen.velden;
    wilJson = gelezen.wilJson;

    // Hidden field that people don't see but spam bots fill in.
    if ((v.website ?? "").trim() !== "") {
      log("spam_geweigerd");
      return fout("ongeldige_gegevens");
    }

    const ongeldig = controleer(v);
    if (ongeldig) return fout(ongeldig);

    type Bestelling = { order_id: string; bedrag_cent: number; aantal: number; evenement: string };
    let bestelling: Bestelling;
    try {
      bestelling = await rpc<Bestelling>("maak_bestelling", {
        p_slug: v.evenement ?? "",
        p_voornaam: v.voornaam,
        p_achternaam: v.achternaam,
        p_email: v.email,
        p_telefoon: v.telefoon ?? "",
        p_woonplaats: v.woonplaats,
        p_aantal: Number(v.aantal),
        p_nieuwsbrief: ["on", "true", "1", "ja"].includes((v.nieuwsbrief ?? "").toLowerCase()),
      });
    } catch (e) {
      if (!(e instanceof DatabaseFout)) throw e;
      const code = Object.keys(MELDINGEN).find((c) => e.message.includes(c)) ?? "fout";
      log("bestelling_geweigerd", { code });
      return fout(code, code === "te_veel_bestellingen" ? 429 : code === "fout" ? 500 : 409);
    }

    const functiesUrl = env("PUBLIC_FUNCTIONS_URL", false);
    let betaling;
    try {
      betaling = await maakBetaling({
        bedragCent: bestelling.bedrag_cent,
        omschrijving: `${bestelling.aantal}× ticket ${bestelling.evenement}`,
        orderId: bestelling.order_id,
        redirectUrl: `${siteUrl}/tickets/bedankt/?bestelling=${bestelling.order_id}`,
        // Without a public address (local development) Mollie cannot call us;
        // the thank-you page then checks the status itself (see ticketinfo).
        webhookUrl: functiesUrl ? `${functiesUrl}/mollie-webhook?forceFunctionRegion=eu-central-1` : "",
      });
    } catch (e) {
      log("mollie_fout", { order_id: bestelling.order_id, fout: String(e) });
      await rpc("betaling_niet_gestart", { p_order_id: bestelling.order_id });
      return fout("betaling_mislukt", 502);
    }

    await rpc("koppel_betaling", { p_order_id: bestelling.order_id, p_payment_id: betaling.id });
    log("bestelling_aangemaakt", { order_id: bestelling.order_id, payment_id: betaling.id, aantal: bestelling.aantal });

    const checkout = betaling._links?.checkout?.href;
    if (!checkout) return fout("betaling_mislukt", 502);
    return wilJson ? json(req, { checkoutUrl: checkout, bestelling: bestelling.order_id }) : doorsturen(checkout);
  } catch (e) {
    log("onverwachte_fout", { fout: String(e) });
    return fout("fout", 500);
  }
});
