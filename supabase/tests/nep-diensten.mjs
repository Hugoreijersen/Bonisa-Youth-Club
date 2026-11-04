// Fake Mollie, MailerSend and MailerLite for automated tests and for trying
// the site locally. Never used in production.
// Start: npm run nep  (listens on port 54399)
// - http://localhost:54399/checkout/tr_...  choose what happens to a payment,
//   like the Mollie test mode does
// - http://localhost:54399/mails            the mails that were "sent"
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

const betalingen = new Map();
const klanten = new Map();
const abonnementen = new Map();
const idempotent = new Map(); // Idempotency-Key -> earlier answer, like Mollie
// Project list as the website publishes it at /geven/projecten.json.
let projecten = [
  { slug: "waterput", naam: "Waterput in het dorp", open: true },
  { slug: "waar-het-nodig-is", naam: "Waar het nodig is", open: true },
  { slug: "afgerond", naam: "Afgerond project", open: false },
];
export const verzoeken = [];
export const mails = [];
export const aanmeldingen = [];

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

const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

// Shows the sent mails, with the inline images (cid:...) filled in.
function mailpagina() {
  const lijst = mails.slice().reverse().map((m, i) => {
    let html = m.html ?? "";
    for (const a of m.attachments ?? []) {
      if (a.id) html = html.replaceAll(`cid:${a.id}`, `data:image/gif;base64,${a.content}`);
    }
    return `<section><h2>${esc(m.subject)}</h2><p>Aan: ${esc(m.to?.[0]?.email)} · Van: ${esc(m.from?.email)}</p>
<iframe title="Mail ${i + 1}" srcdoc="${esc(html)}"></iframe></section>`;
  }).join("") || "<p>Nog geen mails verstuurd.</p>";
  return `<!doctype html><html lang="nl"><meta charset="utf-8"><title>Nagebootste mails</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:44rem;margin:2rem auto;padding:0 1rem}
iframe{width:100%;height:80vh;border:1px solid #ccc;border-radius:.5rem}section{margin-bottom:3rem}</style>
<h1>Nagebootste mails</h1><p>Nieuwste bovenaan. Ververs de pagina na een betaling.</p>${lijst}</html>`;
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
    if (url.pathname === "/__abonnementen") return stuur(res, 200, [...abonnementen.values()]);
    if (url.pathname === "/__projecten" && req.method === "POST") { projecten = JSON.parse(body); return stuur(res, 200, {}); }
    if (url.pathname === "/geven/projecten.json") return stuur(res, 200, { projecten });
    // A monthly payment that Mollie collects itself for a subscription.
    const ab = url.pathname.match(/^\/__abonnement\/(sub_\w+)\/betaling$/);
    if (ab) {
      const s = abonnementen.get(ab[1]);
      if (!s) return stuur(res, 404, {});
      const id = "tr_" + randomBytes(6).toString("hex");
      const b = { id, status: "paid", amount: s.amount, sequenceType: "recurring", customerId: s.customerId,
        subscriptionId: s.id, mandateId: s.mandateId, metadata: null, ...(body ? JSON.parse(body) : {}) };
      betalingen.set(id, b);
      return stuur(res, 201, b);
    }
    if (url.pathname === "/__storing") { server.storing = JSON.parse(body).aan; return stuur(res, 200, {}); }
    if (url.pathname === "/__mailstoring") { server.mailstoring = JSON.parse(body).aan; return stuur(res, 200, {}); }
    if (url.pathname === "/__mails") return stuur(res, 200, mails);
    if (url.pathname === "/__aanmeldingen") return stuur(res, 200, aanmeldingen);
    if (url.pathname === "/mails") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(mailpagina());
    }

    // Fake MailerSend
    if (req.method === "POST" && url.pathname === "/v1/email") {
      if (!(req.headers.authorization ?? "").startsWith("Bearer ")) return stuur(res, 401, {});
      if (server.mailstoring) return stuur(res, 503, { message: "Service unavailable" });
      mails.push(JSON.parse(body));
      res.writeHead(202, { "X-Message-Id": randomBytes(8).toString("hex") });
      return res.end();
    }
    // Fake MailerLite
    if (req.method === "POST" && url.pathname === "/api/subscribers") {
      if (!(req.headers.authorization ?? "").startsWith("Bearer ")) return stuur(res, 401, {});
      const data = JSON.parse(body);
      aanmeldingen.push(data);
      return stuur(res, 201, { data: { id: randomBytes(4).toString("hex"), email: data.email } });
    }

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

    // Same Idempotency-Key and same path: the same answer as the first time.
    const sleutel = req.headers["idempotency-key"];
    if (req.method === "POST" && sleutel && idempotent.has(`${url.pathname} ${sleutel}`)) {
      return stuur(res, 201, idempotent.get(`${url.pathname} ${sleutel}`));
    }
    const onthoud = (data) => { if (sleutel) idempotent.set(`${url.pathname} ${sleutel}`, data); return stuur(res, 201, data); };

    if (req.method === "POST" && url.pathname === "/v2/payments") {
      const data = JSON.parse(body);
      if (data.sequenceType === "first" && !klanten.has(data.customerId)) return stuur(res, 422, { title: "Unknown customer" });
      const id = "tr_" + randomBytes(6).toString("hex");
      const b = { id, status: "open", amount: data.amount, metadata: data.metadata, redirectUrl: data.redirectUrl,
        ...(data.customerId ? { customerId: data.customerId, sequenceType: data.sequenceType ?? "oneoff" } : {}),
        _links: { checkout: { href: `http://localhost:${poort}/checkout/${id}` } } };
      betalingen.set(id, b);
      return onthoud(b);
    }
    const m = url.pathname.match(/^\/v2\/payments\/(tr_\w+)$/);
    if (req.method === "GET" && m) {
      const b = betalingen.get(m[1]);
      if (!b) return stuur(res, 404, { title: "Not Found" });
      // A paid first payment creates a mandate, like at Mollie.
      if (b.sequenceType === "first" && b.status === "paid" && !b.mandateId) b.mandateId = "mdt_" + randomBytes(5).toString("hex");
      return stuur(res, 200, b);
    }

    // Customers and subscriptions (monthly gifts)
    if (req.method === "POST" && url.pathname === "/v2/customers") {
      const data = JSON.parse(body);
      const k = { id: "cst_" + randomBytes(5).toString("hex"), name: data.name, email: data.email };
      klanten.set(k.id, k);
      return onthoud(k);
    }
    const sb = url.pathname.match(/^\/v2\/customers\/(cst_\w+)\/subscriptions(?:\/(sub_\w+))?$/);
    if (sb) {
      if (!klanten.has(sb[1])) return stuur(res, 404, { title: "Not Found" });
      if (req.method === "POST" && !sb[2]) {
        const data = JSON.parse(body);
        const s = { id: "sub_" + randomBytes(5).toString("hex"), customerId: sb[1], status: "active", amount: data.amount,
          interval: data.interval, startDate: data.startDate, description: data.description, mandateId: data.mandateId,
          webhookUrl: data.webhookUrl, metadata: data.metadata };
        abonnementen.set(s.id, s);
        return onthoud(s);
      }
      const s = abonnementen.get(sb[2]);
      if (!s || s.customerId !== sb[1]) return stuur(res, 404, { title: "Not Found" });
      if (req.method === "GET") return stuur(res, 200, s);
      if (req.method === "DELETE") {
        if (s.status === "canceled") return stuur(res, 422, { title: "Unprocessable Entity", detail: "The subscription has been canceled" });
        s.status = "canceled";
        return stuur(res, 200, s);
      }
    }
    stuur(res, 404, { title: "Not Found" });
  });
  return new Promise((ok, fout) => {
    server.once("error", (e) => fout(e.code === "EADDRINUSE"
      ? new Error(`Port ${poort} is in use: stop "npm run nep" first (the tests start their own).`) : e));
    server.listen(poort, "0.0.0.0", () => ok(server));
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await start();
  console.log("Nagebootste Mollie, MailerSend en MailerLite draaien op http://localhost:54399");
  console.log("Verstuurde mails: http://localhost:54399/mails (stoppen: Ctrl+C)");
}
