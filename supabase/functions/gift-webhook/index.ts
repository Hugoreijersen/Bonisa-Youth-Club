// gift-webhook: Mollie calls this when a gift payment changes, also for the
// monthly payments that Mollie collects itself.
//
// Mollie only sends the payment id. We never trust the call itself: we fetch
// the payment from the Mollie API with our own key and use that status and
// amount (docs/beveiliging.md). Safe to call many times.
import { log, MollieFout } from "../_shared/algemeen.ts";
import { verwerkGiftBetaling } from "../_shared/giften.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let id = "";
  try {
    const form = await req.formData();
    id = String(form.get("id") ?? "");
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  // Mollie also calls the subscription webhook with payment ids (tr_...).
  if (!/^tr_[A-Za-z0-9]+$/.test(id)) return new Response("Bad request", { status: 400 });

  try {
    const resultaat = await verwerkGiftBetaling(id);
    log("gift_webhook", { payment_id: id, ...resultaat });
    // Unknown payments also get 200, so the response reveals nothing.
    return new Response("OK", { status: 200 });
  } catch (e) {
    // Unknown or invalid id at Mollie: retrying will not help, so answer 200
    // (Mollie keeps calling on anything else). Our own errors stay 500.
    if (e instanceof MollieFout && [400, 404, 410].includes(e.status)) {
      log("gift_webhook_onbekend", { payment_id: id, mollie_status: e.status });
      return new Response("OK", { status: 200 });
    }
    // A non-200 answer makes Mollie try again later.
    log("gift_webhook_fout", { payment_id: id, fout: String(e) });
    return new Response("Error", { status: 500 });
  }
});
