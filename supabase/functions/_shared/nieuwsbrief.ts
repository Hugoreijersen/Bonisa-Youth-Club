// Newsletter sign-up in MailerLite (data centre in the EU). Only for orders
// where the separate, unticked-by-default checkbox was ticked.
// Without MAILERLITE_API_KEY nothing happens (the order stays "to do").
import { env, log, rpc } from "./algemeen.ts";

export async function aanmeldenNieuwsbrief(orderId: string) {
  if (!env("MAILERLITE_API_KEY", false)) return "uit";
  const persoon = await rpc<{ email: string; voornaam: string; achternaam: string } | null>(
    "nieuwsbrief_claim", { p_order_id: orderId });
  if (!persoon) return "niets";

  const url = env("MAILERLITE_API_URL", false) || "https://connect.mailerlite.com/api";
  const groep = env("MAILERLITE_GROEP", false);
  try {
    const antwoord = await fetch(`${url}/subscribers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env("MAILERLITE_API_KEY")}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email: persoon.email,
        fields: { name: persoon.voornaam, last_name: persoon.achternaam },
        ...(groep ? { groups: [groep] } : {}),
      }),
    });
    if (!antwoord.ok) throw new Error(`MailerLite gave ${antwoord.status}`);
    log("nieuwsbrief_aangemeld", { order_id: orderId });
    return "aangemeld";
  } catch (e) {
    await rpc("nieuwsbrief_mislukt", { p_order_id: orderId });
    throw e;
  }
}
