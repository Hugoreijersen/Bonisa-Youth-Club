// A fake Mollie API for automated tests. Never used in production.
// Start: node supabase/tests/mollie-nep.mjs  (listens on port 54399)
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

const betalingen = new Map();
export const verzoeken = [];

function lees(req) {
  return new Promise((ok) => { let b = ""; req.on("data", (d) => (b += d)); req.on("end", () => ok(b)); });
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

    if (!(req.headers.authorization ?? "").startsWith("Bearer test_")) return stuur(res, 401, { title: "Unauthorized" });
    verzoeken.push({ methode: req.method, pad: url.pathname, body: body ? JSON.parse(body) : null, idempotency: req.headers["idempotency-key"] ?? null });
    if (server.storing) return stuur(res, 503, { title: "Service unavailable" });

    if (req.method === "POST" && url.pathname === "/v2/payments") {
      const data = JSON.parse(body);
      const id = "tr_" + randomBytes(6).toString("hex");
      const b = { id, status: "open", amount: data.amount, metadata: data.metadata,
        _links: { checkout: { href: `https://nep-mollie.test/checkout/${id}` } } };
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
  console.log("Nep-Mollie draait op http://localhost:54399/v2");
}
