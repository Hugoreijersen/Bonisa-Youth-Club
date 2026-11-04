// ticketinfo: public, read-only information for the website. No personal data.
//
//   GET ?evenement=jongerenzang-2027  -> price, max per order, sale status
//   GET ?bestelling=<order id>        -> status of an order (thank-you page)
//
// For an order that is still open, it asks Mollie for the latest status first.
// That way the thank-you page is right even if the webhook is late.
import { corsHeaders, json, leesBestelling, log, rpc } from "../_shared/algemeen.ts";
import { verwerkBetaling } from "../_shared/betaling.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "GET") return json(req, { fout: "methode" }, 405);

  const url = new URL(req.url);

  try {
    const slug = url.searchParams.get("evenement");
    if (slug) {
      const data = await rpc("evenement_info", { p_slug: slug });
      return data ? json(req, data) : json(req, { fout: "onbekend_evenement" }, 404);
    }

    const id = url.searchParams.get("bestelling") ?? "";
    if (UUID.test(id)) {
      const order = await leesBestelling(id, "status,mollie_payment_id") as
        { status: string; mollie_payment_id: string | null } | null;
      if (!order) return json(req, { fout: "onbekende_bestelling" }, 404);

      if (order.status === "open" && order.mollie_payment_id) {
        try {
          await verwerkBetaling(order.mollie_payment_id);
        } catch (e) {
          log("status_controle_fout", { order_id: id, fout: String(e) });
        }
      }
      return json(req, await rpc("bestelling_status", { p_order_id: id }));
    }

    return json(req, { fout: "ongeldige_vraag" }, 400);
  } catch (e) {
    log("ticketinfo_fout", { fout: String(e) });
    return json(req, { fout: "fout" }, 500);
  }
});
