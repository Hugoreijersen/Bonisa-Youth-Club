// mijn-tickets: the personal ticket page (/tickets/mijn/#<toegang>).
//
//   POST {"toegang": "<32 hex>"} -> event, first name and the tickets with QR codes
//
// The secret travels in the request body (not in the address), so it does
// not end up in access logs. It is only in the ticket mail.
import { corsHeaders, json, log, rpc } from "../_shared/algemeen.ts";
import { qrGif } from "../_shared/ticketmail.ts";

type Tickets = {
  status: string;
  tickets: { volgnummer: number; code: string; gescand_op: string | null }[];
  [k: string]: unknown;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { fout: "methode" }, 405);

  try {
    const { toegang } = await req.json().catch(() => ({}));
    if (typeof toegang !== "string" || !/^[0-9a-f]{32}$/.test(toegang)) return json(req, { fout: "onbekend" }, 404);

    const data = await rpc<Tickets | null>("mijn_tickets", { p_toegang: toegang });
    if (!data) return json(req, { fout: "onbekend" }, 404);

    data.tickets = (data.tickets ?? []).map((t) => ({ ...t, qr: qrGif(t.code) }));
    return json(req, data);
  } catch (e) {
    log("mijn_tickets_fout", { fout: String(e) });
    return json(req, { fout: "fout" }, 500);
  }
});
