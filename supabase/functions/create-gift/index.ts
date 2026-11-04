// create-gift: saves a gift for a project and starts a Mollie payment.
//
// Accepts a normal form post (works without JavaScript: answers with a
// redirect) or JSON from the gift page (answers with JSON).
// Monthly gift: first a Mollie customer, then a first payment with iDEAL that
// creates the mandate; the subscription starts after that payment (giften.ts).
// The amount is checked in the database (EUR 1 to EUR 10,000).
import { corsHeaders, DatabaseFout, doorsturen, json, log, rpc } from "../_shared/algemeen.ts";
import { giftenSite, maakGiftBetaling, maakKlant, zoekProject } from "../_shared/giften.ts";

const MELDINGEN: Record<string, string> = {
  onbekend_project: "Dit project bestaat niet (meer) of staat dicht voor giften.",
  ongeldig_bedrag: "Kies een bedrag tussen € 1 en € 10.000.",
  ongeldige_soort: "Kies eenmalig of maandelijks.",
  te_veel_giften: "U heeft het afgelopen uur al vaak gegeven. Probeer het later opnieuw.",
  ongeldige_gegevens: "Niet alle verplichte velden zijn goed ingevuld.",
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

// "25" / "12,50" / "12.5" -> cents. Anything else -> null.
export function bedragInCent(tekst: string): number | null {
  const w = tekst.trim().replace(/^€\s*/, "");
  const m = w.match(/^(\d{1,5})(?:[.,](\d{1,2}))?$/);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0"));
}

function controleer(v: Formulier): string | null {
  const tekst = (naam: string, max: number) => {
    const w = (v[naam] ?? "").trim();
    return w.length > 0 && w.length <= max;
  };
  if (!tekst("voornaam", 100) || !tekst("achternaam", 100)) return "ongeldige_gegevens";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((v.email ?? "").trim()) || v.email.length > 254) return "ongeldige_gegevens";
  if (!["eenmalig", "maandelijks"].includes(v.frequentie ?? "")) return "ongeldige_soort";
  if (!/^[a-z0-9-]{1,60}$/.test(v.project ?? "")) return "onbekend_project";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { fout: "methode" }, 405);

  let wilJson = false;
  let project = "";
  const fout = (code: string, status = 400) =>
    wilJson
      ? json(req, { fout: code, melding: MELDINGEN[code] ?? MELDINGEN.fout }, status)
      : doorsturen(`${giftenSite()}/geven/?fout=${code}${project ? `&project=${encodeURIComponent(project)}` : ""}`);

  try {
    const gelezen = await leesFormulier(req);
    const v = gelezen.velden;
    wilJson = gelezen.wilJson;
    project = /^[a-z0-9-]{1,60}$/.test(v.project ?? "") ? v.project : "";

    // Hidden field that people don't see but spam bots fill in.
    if ((v.website ?? "").trim() !== "") {
      log("spam_geweigerd");
      return fout("ongeldige_gegevens");
    }

    const ongeldig = controleer(v);
    if (ongeldig) return fout(ongeldig);

    // A chosen amount button, or "anders" with an own amount.
    const bedragCent = bedragInCent(v.bedrag === "anders" ? (v.bedrag_anders ?? "") : (v.bedrag ?? ""));
    if (bedragCent === null) return fout("ongeldig_bedrag");

    const gevonden = await zoekProject(v.project);
    if (!gevonden) return fout("onbekend_project", 404);

    type Gift = { gift_id: string; periodiek_id: string | null; soort: string; bedrag_cent: number; project_naam: string };
    let gift: Gift;
    try {
      gift = await rpc<Gift>("maak_gift", {
        p_soort: v.frequentie,
        p_project_slug: gevonden.slug,
        p_project_naam: gevonden.naam,
        p_voornaam: v.voornaam,
        p_achternaam: v.achternaam,
        p_email: v.email,
        p_bedrag_cent: bedragCent,
        p_nieuwsbrief: ["on", "true", "1", "ja"].includes((v.nieuwsbrief ?? "").toLowerCase()),
      });
    } catch (e) {
      if (!(e instanceof DatabaseFout)) throw e;
      const code = Object.keys(MELDINGEN).find((c) => e.message.includes(c)) ?? "fout";
      log("gift_geweigerd", { code });
      return fout(code, code === "te_veel_giften" ? 429 : code === "fout" ? 500 : 400);
    }

    let betaling;
    try {
      let customerId: string | undefined;
      if (gift.periodiek_id) {
        const klant = await maakKlant(gift.periodiek_id, `${v.voornaam.trim()} ${v.achternaam.trim()}`, v.email.trim().toLowerCase());
        await rpc("koppel_klant", { p_periodiek_id: gift.periodiek_id, p_customer_id: klant.id });
        customerId = klant.id;
      }
      betaling = await maakGiftBetaling({
        bedragCent: gift.bedrag_cent,
        omschrijving: `${gift.periodiek_id ? "Maandelijkse gift" : "Gift"} ${gift.project_naam}`.slice(0, 250),
        giftId: gift.gift_id,
        customerId,
      });
    } catch (e) {
      log("mollie_fout", { gift_id: gift.gift_id, fout: String(e) });
      await rpc("gift_niet_gestart", { p_gift_id: gift.gift_id });
      return fout("betaling_mislukt", 502);
    }

    await rpc("koppel_gift_betaling", { p_gift_id: gift.gift_id, p_payment_id: betaling.id });
    log("gift_aangemaakt", { gift_id: gift.gift_id, payment_id: betaling.id, soort: gift.soort });

    const checkout = betaling._links?.checkout?.href;
    if (!checkout) return fout("betaling_mislukt", 502);
    return wilJson ? json(req, { checkoutUrl: checkout, gift: gift.gift_id }) : doorsturen(checkout);
  } catch (e) {
    log("onverwachte_fout", { fout: String(e) });
    return fout("fout", 500);
  }
});
