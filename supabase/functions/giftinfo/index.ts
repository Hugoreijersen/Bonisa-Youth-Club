// giftinfo: public, read-only information for the website. No personal data.
//
//   GET ?projecten=1          -> online totals per project (progress bars)
//   GET ?gift=<gift id>       -> status of a gift (thank-you page)
//   GET ?stopcode=<code>      -> project, amount and status of a monthly gift (stop page)
//
// For a gift that is still open, it asks Mollie for the latest status first,
// and it finishes a monthly gift whose start is still waiting. That way the
// thank-you page is right even if the webhook is late.
import { corsHeaders, json, log, rpc, tabel } from "../_shared/algemeen.ts";
import { verwerkGiftBetaling } from "../_shared/giften.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE = /^[0-9a-f]{32}$/;

type Status = { status: string; soort: string; periodiek: string | null };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "GET") return json(req, { fout: "methode" }, 405);

  const url = new URL(req.url);

  try {
    if (url.searchParams.has("projecten")) return json(req, await rpc("projectstanden", {}));

    const stopcode = (url.searchParams.get("stopcode") ?? "").toLowerCase();
    if (CODE.test(stopcode)) {
      const info = await rpc("periodiek_info", { p_stopcode: stopcode });
      return info ? json(req, info) : json(req, { fout: "onbekend" }, 404);
    }

    const id = url.searchParams.get("gift") ?? "";
    if (UUID.test(id)) {
      const status = await rpc<Status | null>("gift_status", { p_gift_id: id });
      if (!status) return json(req, { fout: "onbekende_gift" }, 404);

      const wacht = status.status === "open" || (status.soort === "eerste" && status.periodiek === "wacht_op_eerste");
      if (wacht) {
        const rij = (await tabel(`giften?id=eq.${id}&select=mollie_payment_id`) as { mollie_payment_id: string | null }[])[0];
        if (rij?.mollie_payment_id) {
          try {
            await verwerkGiftBetaling(rij.mollie_payment_id);
          } catch (e) {
            log("gift_status_controle_fout", { gift_id: id, fout: String(e) });
          }
        }
      }
      return json(req, await rpc("gift_status", { p_gift_id: id }));
    }

    return json(req, { fout: "ongeldige_vraag" }, 400);
  } catch (e) {
    log("giftinfo_fout", { fout: String(e) });
    return json(req, { fout: "fout" }, 500);
  }
});
