// scan: checks a ticket at the door. Only for logged-in scanners and office.
//
//   POST {"evenement": "<slug>", "code": "<ticket code>"}  (Authorization: Bearer <login token>)
//
// Answers geldig | al_gescand | onbekend | ongeldig | ander_evenement.
import { corsHeaders, DatabaseFout, gebruikerVan, json, log, rpc } from "../_shared/algemeen.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { fout: "methode" }, 405);

  try {
    const gebruiker = await gebruikerVan(req);
    if (!gebruiker) return json(req, { fout: "niet_ingelogd" }, 401);
    if (gebruiker.rol !== "scanner" && gebruiker.rol !== "kantoor") return json(req, { fout: "geen_toegang" }, 403);

    const { evenement, code } = await req.json().catch(() => ({}));
    const schoon = String(code ?? "").trim().toLowerCase();
    if (typeof evenement !== "string" || !/^[0-9a-f]{32}$/.test(schoon)) {
      return json(req, { resultaat: "onbekend" });
    }

    const uitslag = await rpc<{ resultaat: string }>("scan_ticket", {
      p_slug: evenement, p_code: schoon, p_user_id: gebruiker.id,
    });
    log("scan", { resultaat: uitslag.resultaat });
    return json(req, uitslag);
  } catch (e) {
    if (e instanceof DatabaseFout && e.message === "onbekend_evenement") return json(req, { fout: "onbekend_evenement" }, 404);
    log("scan_fout", { fout: String(e) });
    return json(req, { fout: "fout" }, 500);
  }
});
