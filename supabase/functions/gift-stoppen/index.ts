// gift-stoppen: the giver stops a monthly gift with the stop link from the
// thank-you mail (/geven/stoppen/#<code>).
//
//   POST {"code": "<stop code>"}  -> {"uitkomst": "gestopt" | "al_gestopt" | "niet_actief"}
//
// The code is 128 random bits and only in that mail, so it works like a key.
import { corsHeaders, json, log } from "../_shared/algemeen.ts";
import { stopPeriodiek } from "../_shared/giften.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { fout: "methode" }, 405);

  try {
    const v = await req.json().catch(() => ({})) as Record<string, unknown>;
    const code = String(v.code ?? "").toLowerCase();
    if (!/^[0-9a-f]{32}$/.test(code)) return json(req, { fout: "onbekend" }, 404);

    const uitkomst = await stopPeriodiek({ stopcode: code }, "gever");
    if (uitkomst === "onbekend") return json(req, { fout: "onbekend" }, 404);
    return json(req, { uitkomst });
  } catch (e) {
    log("gift_stoppen_fout", { fout: String(e) });
    return json(req, { fout: "fout" }, 500);
  }
});
