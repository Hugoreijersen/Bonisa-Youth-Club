// Fetch a payment from Mollie and store its status. Used by the webhook and,
// as a backup, by the thank-you page (ticketinfo).
import { bedragInEuro, euroNaarCent, haalBetaling, log, rpc } from "./algemeen.ts";
import { aanmeldenNieuwsbrief } from "./nieuwsbrief.ts";
import { verstuurTicketmail } from "./ticketmail.ts";

export async function verwerkBetaling(paymentId: string) {
  // Never trust the caller: always ask Mollie itself.
  const betaling = await haalBetaling(paymentId);
  const resultaat = await rpc<{ resultaat: string; status?: string; order_id?: string }>("verwerk_betaling", {
    p_payment_id: betaling.id,
    p_mollie_status: betaling.status,
    p_bedrag_cent: bedragInEuro(betaling.amount),
    // A chargeback counts as a refund: the tickets are no longer valid.
    p_terugbetaald_cent: euroNaarCent(betaling.amountRefunded?.value) + euroNaarCent(betaling.amountChargedBack?.value),
  });
  if (resultaat.status === "betaald" && resultaat.order_id) await naBetaling(resultaat.order_id);
  return resultaat;
}

// After payment: ticket mail and newsletter. Both are safe to run again; they
// only do what has not been done yet. An error is thrown on, so the webhook
// answers 500 and Mollie tries again later.
export async function naBetaling(orderId: string) {
  const fouten: string[] = [];
  for (const [taak, stap] of [["ticketmail", verstuurTicketmail], ["nieuwsbrief", aanmeldenNieuwsbrief]] as const) {
    try {
      await stap(orderId);
    } catch (e) {
      log(`${taak}_fout`, { order_id: orderId, fout: String(e) });
      fouten.push(taak);
    }
  }
  if (fouten.length) throw new Error(`na_betaling_mislukt: ${fouten.join(", ")}`);
}
