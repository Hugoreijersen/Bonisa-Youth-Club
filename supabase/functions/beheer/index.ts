// beheer: the management page for office (/beheer/). Login required.
//
//   POST {"actie": "...", ...}   (Authorization: Bearer <login token>)
//
// Actions: ik, evenementen, overzicht, bestellingen, export, mail_opnieuw,
// evenement_opslaan, beheerders, beheerder_toevoegen, uitnodiging_opnieuw, rol_wijzigen,
// beheerder_verwijderen,
// and for gifts (docs/giften.md): giften_overzicht, giften_export,
// periodieke_giften, periodiek_stoppen.
// Everything except "ik" is only for the role kantoor.
import {
  authAdmin, corsHeaders, DatabaseFout, gebruikerVan, json, log, rpc, siteVan, tabel, uitnodigen,
} from "../_shared/algemeen.ts";
import { stopPeriodiek } from "../_shared/giften.ts";
import { verstuurTicketmail } from "../_shared/ticketmail.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9-]{1,60}$/;
const DATUM = /^\d{4}-\d{2}-\d{2}$/;

class Fout extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}

async function eventId(slug: unknown): Promise<string> {
  if (typeof slug !== "string" || !SLUG.test(slug)) throw new Fout("onbekend_evenement", 404);
  const rijen = await tabel(`events?slug=eq.${slug}&select=id`) as { id: string }[];
  if (!rijen.length) throw new Fout("onbekend_evenement", 404);
  return rijen[0].id;
}

const ORDER_KOLOMMEN =
  "id,voornaam,achternaam,email,telefoon,woonplaats,aantal,bedrag_cent,status,nieuwsbrief," +
  "aangemaakt_op,betaald_op,mail_verstuurd_op,mollie_payment_id";

// Event fields office may change. Amounts in cents, times as ISO strings.
function evenementVelden(e: Record<string, unknown>) {
  const tekst = (k: string, max: number) => {
    const w = String(e[k] ?? "").trim();
    if (!w || w.length > max) throw new Fout(`ongeldig_${k}`);
    return w;
  };
  const geheel = (k: string, min: number, max: number) => {
    const n = Number(e[k]);
    if (!Number.isInteger(n) || n < min || n > max) throw new Fout(`ongeldig_${k}`);
    return n;
  };
  const tijd = (k: string, verplicht: boolean) => {
    const w = String(e[k] ?? "").trim();
    if (!w) {
      if (verplicht) throw new Fout(`ongeldig_${k}`);
      return null;
    }
    const d = new Date(w);
    if (isNaN(d.getTime())) throw new Fout(`ongeldig_${k}`);
    return d.toISOString();
  };
  const slug = String(e.slug ?? "");
  if (!SLUG.test(slug)) throw new Fout("ongeldig_slug");
  return {
    slug,
    naam: tekst("naam", 120),
    locatie: tekst("locatie", 120),
    begint_op: tijd("begint_op", true),
    prijs_cent: geheel("prijs_cent", 0, 100000),
    max_tickets: geheel("max_tickets", 1, 100000),
    max_per_bestelling: geheel("max_per_bestelling", 1, 50),
    verkoop_open_vanaf: tijd("verkoop_open_vanaf", false),
    verkoop_dicht_op: tijd("verkoop_dicht_op", false),
  };
}

async function alleGebruikers(): Promise<
  { id: string; email: string; last_sign_in_at?: string; invited_at?: string; email_confirmed_at?: string }[]
> {
  const { ok, data } = await authAdmin("users?per_page=1000");
  if (!ok) throw new Fout("fout", 500);
  return data.users ?? [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { fout: "methode" }, 405);

  let actie = "";
  try {
    const gebruiker = await gebruikerVan(req);
    if (!gebruiker) return json(req, { fout: "niet_ingelogd" }, 401);

    const v = await req.json().catch(() => ({})) as Record<string, unknown>;
    actie = String(v.actie ?? "");

    if (actie === "ik") return json(req, { email: gebruiker.email, rol: gebruiker.rol });
    if (gebruiker.rol !== "kantoor") return json(req, { fout: "geen_toegang" }, 403);

    let antwoord: unknown;
    switch (actie) {
      case "evenementen":
        antwoord = await tabel("events?select=id,slug,naam,begint_op&order=begint_op.desc");
        break;

      case "overzicht":
        await eventId(v.evenement);
        antwoord = await rpc("beheer_overzicht", { p_slug: v.evenement });
        break;

      case "bestellingen": {
        const id = await eventId(v.evenement);
        antwoord = await tabel(`orders?event_id=eq.${id}&select=${ORDER_KOLOMMEN}&order=aangemaakt_op.desc&limit=5000`);
        break;
      }

      case "export": {
        // Everything, for the weekly back-up (docs/back-up.md).
        const id = await eventId(v.evenement);
        const orders = await tabel(`orders?event_id=eq.${id}&select=*&order=aangemaakt_op&limit=10000`) as { id: string }[];
        const tickets = await tabel(
          `tickets?select=order_id,volgnummer,code,gescand_op,orders!inner(event_id)&orders.event_id=eq.${id}&order=aangemaakt_op&limit=50000`,
        ) as Record<string, unknown>[];
        antwoord = { orders, tickets: tickets.map(({ orders: _o, ...t }) => t) };
        break;
      }

      case "mail_opnieuw": {
        if (typeof v.order_id !== "string" || !UUID.test(v.order_id)) throw new Fout("onbekende_bestelling", 404);
        const uitkomst = await verstuurTicketmail(v.order_id, true);
        if (uitkomst !== "verstuurd") throw new Fout("niet_betaald_of_bezig", 409);
        antwoord = { uitkomst };
        break;
      }

      case "evenement_opslaan": {
        const velden = evenementVelden((v.evenement ?? {}) as Record<string, unknown>);
        const bestaand = await tabel(`events?slug=eq.${velden.slug}&select=id`) as { id: string }[];
        if (bestaand.length) {
          const info = await rpc<{ verkocht: number }>("beheer_overzicht", { p_slug: velden.slug });
          if (velden.max_tickets < info.verkocht) throw new Fout("minder_dan_verkocht");
          antwoord = await tabel(`events?id=eq.${bestaand[0].id}`, {
            method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(velden),
          });
        } else {
          antwoord = await tabel("events", {
            method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(velden),
          });
        }
        break;
      }

      case "beheerders": {
        // Every account, also the ones without a role yet (for example someone
        // who accepted an invitation from Supabase). Visitors have no accounts.
        const rollen = await tabel("beheerders?select=user_id,rol,aangemaakt_op") as
          { user_id: string; rol: string }[];
        const gebruikers = await alleGebruikers();
        antwoord = gebruikers
          .map((g) => ({
            user_id: g.id,
            email: g.email ?? "",
            rol: rollen.find((r) => r.user_id === g.id)?.rol ?? null,
            laatst_ingelogd: g.last_sign_in_at ?? null,
            // Invited, but the link has not been used yet.
            uitnodiging_open: Boolean(g.invited_at && !g.email_confirmed_at),
            ikzelf: g.id === gebruiker.id,
          }))
          .sort((a, b) => (a.rol ? 1 : 0) - (b.rol ? 1 : 0) || a.email.localeCompare(b.email));
        break;
      }

      case "rol_wijzigen": {
        // Give an existing account a role, change it, or take it away ("geen").
        const id = String(v.user_id ?? "");
        const rol = String(v.rol ?? "");
        if (!UUID.test(id)) throw new Fout("onbekend", 404);
        if (!["kantoor", "scanner", "geen"].includes(rol)) throw new Fout("ongeldige_rol");
        if (id === gebruiker.id) throw new Fout("niet_jezelf");
        const bestaat = await authAdmin(`users/${id}`);
        if (!bestaat.ok) throw new Fout("onbekend", 404);
        if (rol === "geen") {
          await tabel(`beheerders?user_id=eq.${id}`, { method: "DELETE" });
        } else {
          await tabel("beheerders?on_conflict=user_id", {
            method: "POST",
            headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
            body: JSON.stringify({ user_id: id, rol }),
          });
        }
        antwoord = { user_id: id, rol: rol === "geen" ? null : rol };
        break;
      }

      case "beheerder_toevoegen": {
        const email = String(v.email ?? "").trim().toLowerCase();
        const wachtwoord = String(v.wachtwoord ?? "");
        const rol = String(v.rol ?? "");
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Fout("ongeldig_email");
        if (!["kantoor", "scanner"].includes(rol)) throw new Fout("ongeldige_rol");
        let userId = (await alleGebruikers()).find((u) => u.email === email)?.id;
        let uitgenodigd = false;
        if (!userId && !wachtwoord) {
          // Usual way: an invitation by mail; they choose their own password.
          const nieuw = await uitnodigen(email, `${siteVan(req)}/welkom/`);
          if (nieuw.status === 429) throw new Fout("te_veel_mails", 429);
          if (!nieuw.ok) throw new Fout("uitnodigen_mislukt");
          userId = nieuw.data.id;
          uitgenodigd = true;
        } else if (!userId) {
          // Still possible: an account with a password that office passes on.
          if (wachtwoord.length < 10) throw new Fout("wachtwoord_te_kort");
          const nieuw = await authAdmin("users", {
            method: "POST", body: JSON.stringify({ email, password: wachtwoord, email_confirm: true }),
          });
          if (!nieuw.ok) throw new Fout("account_mislukt");
          userId = nieuw.data.id;
        }
        await tabel("beheerders?on_conflict=user_id", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({ user_id: userId, rol }),
        });
        antwoord = { user_id: userId, rol, uitgenodigd };
        break;
      }

      case "uitnodiging_opnieuw": {
        // For someone who has not used the invitation yet (link expired or lost).
        const id = String(v.user_id ?? "");
        if (!UUID.test(id)) throw new Fout("onbekend", 404);
        const g = await authAdmin(`users/${id}`);
        if (!g.ok) throw new Fout("onbekend", 404);
        if (g.data.email_confirmed_at) throw new Fout("al_aangemeld", 409);
        const r = await uitnodigen(g.data.email, `${siteVan(req)}/welkom/`);
        if (r.status === 429) throw new Fout("te_veel_mails", 429);
        if (!r.ok) throw new Fout("uitnodigen_mislukt");
        antwoord = { verstuurd: g.data.email };
        break;
      }

      case "beheerder_verwijderen": {
        const id = String(v.user_id ?? "");
        if (!UUID.test(id)) throw new Fout("onbekend");
        if (id === gebruiker.id) throw new Fout("niet_jezelf");
        await tabel(`beheerders?user_id=eq.${id}`, { method: "DELETE" });
        await authAdmin(`users/${id}`, { method: "DELETE" });
        antwoord = { verwijderd: id };
        break;
      }

      // --- Gifts -------------------------------------------------------------
      case "giften_overzicht":
        antwoord = await rpc("giften_overzicht", {});
        break;

      case "giften_export": {
        // All gifts paid (or started) between two dates, for the administration.
        const van = String(v.van ?? ""), tot = String(v.tot ?? "");
        if (!DATUM.test(van) || !DATUM.test(tot) || van > tot) throw new Fout("ongeldige_periode");
        const rijen = await rpc<Record<string, unknown>[]>("giften_export", { p_van: van, p_tot: tot });
        // Fixed column order for the CSV (the database returns keys sorted otherwise).
        const kolommen = ["datum", "project", "soort", "bedrag", "status", "voornaam", "achternaam", "email",
          "maandelijkse_gift", "mollie_betaling", "gift_id"];
        antwoord = rijen.map((r) => Object.fromEntries(kolommen.map((k) => [k, r[k]])));
        break;
      }

      case "periodieke_giften":
        antwoord = await rpc("periodieke_giften_lijst", {});
        break;

      case "periodiek_stoppen": {
        if (typeof v.id !== "string" || !UUID.test(v.id)) throw new Fout("onbekend", 404);
        const uitkomst = await stopPeriodiek({ id: v.id }, "kantoor");
        if (uitkomst === "onbekend") throw new Fout("onbekend", 404);
        antwoord = { uitkomst };
        break;
      }

      default:
        throw new Fout("onbekende_actie");
    }

    log("beheer", { actie });
    return json(req, antwoord);
  } catch (e) {
    if (e instanceof Fout) return json(req, { fout: e.code }, e.status);
    if (e instanceof DatabaseFout) {
      log("beheer_fout", { actie, fout: e.message });
      return json(req, { fout: "database", melding: e.message }, 400);
    }
    log("beheer_fout", { actie, fout: String(e) });
    return json(req, { fout: "fout" }, 500);
  }
});
