// Fetch a payment from Mollie and store its status. Used by the webhook and,
// as a backup, by the thank-you page (ticketinfo).
import { euroNaarCent, haalBetaling, rpc } from "./algemeen.ts";

export async function verwerkBetaling(paymentId: string) {
  // Never trust the caller: always ask Mollie itself.
  const betaling = await haalBetaling(paymentId);
  return await rpc<{ resultaat: string; status?: string }>("verwerk_betaling", {
    p_payment_id: betaling.id,
    p_mollie_status: betaling.status,
    p_bedrag_cent: euroNaarCent(betaling.amount?.value),
    p_terugbetaald_cent: euroNaarCent(betaling.amountRefunded?.value),
  });
}
