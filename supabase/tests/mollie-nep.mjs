// A fake Mollie API for automated tests and for trying the order page locally.
// Never used in production.
// Start: node supabase/tests/mollie-nep.mjs  (listens on port 54399)
// The checkout page (http://localhost:54399/checkout/tr_...) lets you choose
// what happens to the payment, like the Mollie test mode does.
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

const betalingen = new Map();
export const verzoeken = [];

function lees(req) {
  return new Promise((ok) => { let b = ""; req.on("data", (d) => (b += d)); req.on("end", () => ok(b)); });
}
const KEUZES = [["paid", "Betaald"], ["failed", "Mislukt"], ["canceled", "Geannuleerd"], ["expired", "Verlopen"]];

function betaalpagina(b) {
  const knoppen = KEUZES.map(([status, label]) =>
    `<button name="status" value="${status}">${label}</button>`).join("");
  return `<!doctype html><html lang="nl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nagebootste Mollie</title>
<style>body{font:18px/1.5 system-ui,sans-serif;max-width:28rem;margin:3rem auto;padding:0 1rem}
form{display:grid;gap:.75rem}button{font:inherit;padding:.8rem;border-radius:.5rem;border:1px solid #888;cursor:pointer}
button[value=paid]{background:#4C8C40;color:#fff;border-color:#4C8C40}p small{color:#555}</style>
<h1>Nagebootste Mollie</h1>
<p>Te betalen: <strong>€ ${b.amount?.value?.replace(".", ",")}</strong><br><small>Betaling ${b.id}. Dit is geen echte betaling.</small></p>
<form method="post">${knoppen}</form></html>`;
}

function stuur(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

export function start(poort = 54399) {
  const server = createServer(async (req, res) => {
    const body = await lees(req);
    const url = new URL(req.url, "http://localhost");
    // Test controls (not part of Mollie)
    if (url.pathname.startsWith("/__zet/")) {
      const b = betalingen.get(url.pathname.slice(7));
      if (!b) return stuur(res, 404, {});
      Object.assign(b, JSON.parse(body));
      return stuur(res, 200, b);
    }
    if (url.pathname === "/__verzoeken") return stuur(res, 200, verzoeken);
    if (url.pathname === "/__storing") { server.storing = JSON.parse(body).aan; return stuur(res, 200, {}); }

    // Checkout page, opened in the browser by the visitor
    const k = url.pathname.match(/^\/checkout\/(tr_\w+)$/);
    if (k) {
      const b = betalingen.get(k[1]);
      if (!b) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("Onbekende betaling"); }
      if (req.method === "POST") {
        const status = new URLSearchParams(body).get("status");
        if (KEUZES.some(([s]) => s === status)) b.status = status;
        // Back to the thank-you page. That page asks ticketinfo, which checks
        // the payment here (locally the webhook URL is not reachable).
        res.writeHead(303, { Location: b.redirectUrl });
        return res.end();
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(betaalpagina(b));
    }

    if (!(req.headers.authorization ?? "").startsWith("Bearer test_")) return stuur(res, 401, { title: "Unauthorized" });
    verzoeken.push({ methode: req.method, pad: url.pathname, body: body ? JSON.parse(body) : null, idempotency: req.headers["idempotency-key"] ?? null });
    if (server.storing) return stuur(res, 503, { title: "Service unavailable" });

    if (req.method === "POST" && url.pathname === "/v2/payments") {
      const data = JSON.parse(body);
      const id = "tr_" + randomBytes(6).toString("hex");
      const b = { id, status: "open", amount: data.amount, metadata: data.metadata, redirectUrl: data.redirectUrl,
        _links: { checkout: { href: `http://localhost:${poort}/checkout/${id}` } } };
      betalingen.set(id, b);
      return stuur(res, 201, b);
    }
    const m = url.pathname.match(/^\/v2\/payments\/(tr_\w+)$/);
    if (req.method === "GET" && m) {
      const b = betalingen.get(m[1]);
      return b ? stuur(res, 200, b) : stuur(res, 404, { title: "Not Found" });
    }
    stuur(res, 404, { title: "Not Found" });
  });
  return new Promise((ok) => server.listen(poort, "0.0.0.0", () => ok(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await start();
  console.log("Nagebootste Mollie draait op http://localhost:54399 (stoppen: Ctrl+C)");
}
