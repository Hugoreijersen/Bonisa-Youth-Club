// End-to-end tests for ordering and paying, against a local Supabase and the
// fake Mollie. How to run: docs/ticketsysteem.md ("Testen").
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { start as startNepMollie } from "./mollie-nep.mjs";

// Keys of the local Supabase (`npm run db:start`). Not secret: they only work locally.
const lokaal = () => Object.fromEntries(
  execSync("npx --yes supabase@3.0.0 status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    .split("\n").map((r) => r.match(/^(\w+)="?(.*?)"?$/)).filter(Boolean).map((m) => [m[1], m[2]]),
);
const sleutels = process.env.SUPABASE_SERVICE_ROLE_KEY ? {} : lokaal();
const API = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? sleutels.SERVICE_ROLE_KEY;
const ANON = process.env.SUPABASE_ANON_KEY ?? sleutels.ANON_KEY;
const F = `${API}/functions/v1`;
const NEP = "http://127.0.0.1:54399";
const SLUG = "jongerenzang-2027";

if (!SERVICE || !ANON) throw new Error("Local Supabase not running: npm run db:start");

let nep;
before(async () => { nep = await startNepMollie(); });
after(() => nep?.close());

// --- helpers ---------------------------------------------------------------
const db = async (pad, init = {}) => {
  const r = await fetch(`${API}/rest/v1/${pad}`, {
    ...init,
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers ?? {}) },
  });
  const t = await r.text();
  return t ? JSON.parse(t) : null;
};
const zetEvenement = (velden) => db(`events?slug=eq.${SLUG}`, { method: "PATCH", body: JSON.stringify(velden) });
const order = async (id) => (await db(`orders?id=eq.${id}&select=*`))[0];
const tickets = (id) => db(`tickets?order_id=eq.${id}&select=*`);
const nepZet = (id, velden) => fetch(`${NEP}/__zet/${id}`, { method: "POST", body: JSON.stringify(velden) });
const webhook = (id) => fetch(`${F}/mollie-webhook`, { method: "POST", body: new URLSearchParams({ id }) });
const verzoeken = async () => (await fetch(`${NEP}/__verzoeken`)).json();

let teller = 0;
const gegevens = (extra = {}) => ({
  evenement: SLUG, voornaam: "Test", achternaam: "Persoon", email: `test${Date.now()}-${teller++}@voorbeeld.nl`,
  telefoon: "", woonplaats: "Katwijk", aantal: "2", akkoord: "on", nieuwsbrief: "", website: "", ...extra,
});
const bestelJson = (extra) => fetch(`${F}/create-order`, {
  method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:8080" }, body: JSON.stringify(gegevens(extra)),
});
const bestelFormulier = (extra) => fetch(`${F}/create-order`, {
  method: "POST", body: new URLSearchParams(gegevens(extra)), redirect: "manual",
});
const paymentVan = async (orderId) => (await order(orderId)).mollie_payment_id;

// --- tests -----------------------------------------------------------------
test("evenementinfo: prijs en status, zonder persoonsgegevens", async () => {
  await zetEvenement({ max_tickets: 500, verkoop_open_vanaf: new Date(Date.now() - 864e5).toISOString(), verkoop_dicht_op: null });
  const info = await (await fetch(`${F}/ticketinfo?evenement=${SLUG}`)).json();
  assert.equal(info.prijs_cent, 450);
  assert.equal(info.verkoop, "open");
  assert.deepEqual(Object.keys(info).sort(), ["max_per_bestelling", "naam", "plaatsen_vrij", "prijs_cent", "slug", "verkoop"]);
});

test("bestellen: bedrag komt uit de database, niet uit het formulier", async () => {
  const r = await bestelJson({ aantal: "2", bedrag: "0.01", prijs_cent: "1" });
  assert.equal(r.status, 200);
  const { checkoutUrl, bestelling } = await r.json();
  assert.match(checkoutUrl, /^http:\/\/localhost:54399\/checkout\/tr_/);
  const o = await order(bestelling);
  assert.equal(o.status, "open");
  assert.equal(o.bedrag_cent, 900);
  assert.equal(o.nieuwsbrief, false);
  const laatste = (await verzoeken()).filter((v) => v.methode === "POST").at(-1);
  assert.deepEqual(laatste.body.amount, { currency: "EUR", value: "9.00" });
  assert.equal(laatste.idempotency, bestelling);
  assert.match(laatste.body.webhookUrl, /mollie-webhook\?forceFunctionRegion=eu-central-1$/);
  assert.match(laatste.body.redirectUrl, new RegExp(`/tickets/bedankt/\\?bestelling=${bestelling}$`));
});

test("betaald via webhook: tickets met lange willekeurige codes, en twee keer melden maakt niet dubbel", async () => {
  const { bestelling } = await (await bestelJson({ aantal: "3", nieuwsbrief: "on" })).json();
  const pid = await paymentVan(bestelling);
  assert.equal((await webhook(pid)).status, 200); // still open: nothing happens
  assert.equal((await order(bestelling)).status, "open");

  await nepZet(pid, { status: "paid" });
  assert.equal((await webhook(pid)).status, 200);
  assert.equal((await webhook(pid)).status, 200);
  const o = await order(bestelling);
  assert.equal(o.status, "betaald");
  assert.equal(o.nieuwsbrief, true);
  assert.ok(o.betaald_op);
  const t = await tickets(bestelling);
  assert.equal(t.length, 3);
  for (const ticket of t) assert.match(ticket.code, /^[0-9a-f]{32}$/);
  assert.equal(new Set(t.map((x) => x.code)).size, 3);
});

test("webhook vertrouwt de melding niet: verkeerd bedrag bij Mollie wordt geweigerd", async () => {
  const { bestelling } = await (await bestelJson({ aantal: "1" })).json();
  const pid = await paymentVan(bestelling);
  await nepZet(pid, { status: "paid", amount: { currency: "EUR", value: "0.01" } });
  assert.equal((await webhook(pid)).status, 500);
  assert.equal((await order(bestelling)).status, "open");
  assert.equal((await tickets(bestelling)).length, 0);
});

test("webhook: onbekende betaling geeft 200, onzin geeft 400", async () => {
  assert.equal((await webhook("tr_bestaatniet")).status, 200);
  assert.equal((await webhook("geen-id")).status, 400);
});

test("verlopen, mislukt en terugbetaald", async () => {
  const maak = async () => { const { bestelling } = await (await bestelJson({ aantal: "1" })).json(); return [bestelling, await paymentVan(bestelling)]; };
  const [a, pa] = await maak(); await nepZet(pa, { status: "expired" }); await webhook(pa);
  assert.equal((await order(a)).status, "verlopen");
  const [b, pb] = await maak(); await nepZet(pb, { status: "canceled" }); await webhook(pb);
  assert.equal((await order(b)).status, "mislukt");
  const [c, pc] = await maak(); await nepZet(pc, { status: "paid" }); await webhook(pc);
  await nepZet(pc, { amountRefunded: { currency: "EUR", value: "4.50" } }); await webhook(pc);
  assert.equal((await order(c)).status, "terugbetaald");
  // a paid order never falls back to failed
  const [d, pd] = await maak(); await nepZet(pd, { status: "paid" }); await webhook(pd);
  await nepZet(pd, { status: "failed" }); await webhook(pd);
  assert.equal((await order(d)).status, "betaald");
});

test("bedankpagina controleert zelf bij Mollie als de webhook te laat is", async () => {
  const { bestelling } = await (await bestelJson({ aantal: "1" })).json();
  await nepZet(await paymentVan(bestelling), { status: "paid" });
  const s = await (await fetch(`${F}/ticketinfo?bestelling=${bestelling}`)).json();
  assert.deepEqual(s, { status: "betaald", aantal: 1, bedrag_cent: 450, evenement: "Katwijkse Jongerenzang 2027" });
  assert.equal((await tickets(bestelling)).length, 1);
});

test("zonder JavaScript: gewoon formulier stuurt door naar Mollie of terug met foutcode", async () => {
  const goed = await bestelFormulier();
  assert.equal(goed.status, 303);
  assert.match(goed.headers.get("location"), /^http:\/\/localhost:54399\/checkout\//);
  const fout = await bestelFormulier({ akkoord: "" });
  assert.equal(fout.status, 303);
  assert.equal(fout.headers.get("location"), "http://localhost:8080/tickets/?fout=geen_akkoord");
});

test("controles: spamveld, aantal, verplichte velden", async () => {
  const spam = await bestelJson({ website: "http://spam" });
  assert.equal(spam.status, 400);
  assert.equal((await bestelJson({ aantal: "11" })).status, 409);
  assert.equal((await (await bestelJson({ aantal: "0" })).json()).fout, "ongeldig_aantal");
  assert.equal((await (await bestelJson({ email: "geen-mail" })).json()).fout, "ongeldige_gegevens");
  assert.equal((await (await bestelJson({ voornaam: " " })).json()).fout, "ongeldige_gegevens");
});

test("niet meer tickets verkopen dan er plaatsen zijn", async () => {
  const info = await (await fetch(`${F}/ticketinfo?evenement=${SLUG}`)).json();
  const bezet = 500 - info.plaatsen_vrij;
  await zetEvenement({ max_tickets: bezet + 1 });
  const r = await (await bestelJson({ aantal: "2" })).json();
  assert.equal(r.fout, "niet_genoeg_plaatsen");
  assert.ok((await (await bestelJson({ aantal: "1" })).json()).checkoutUrl);
  assert.equal((await (await fetch(`${F}/ticketinfo?evenement=${SLUG}`)).json()).verkoop, "uitverkocht");
  await zetEvenement({ max_tickets: 500 });
});

test("gelijktijdige bestellingen voor de laatste plaatsen: nooit te veel verkocht", async () => {
  const info = await (await fetch(`${F}/ticketinfo?evenement=${SLUG}`)).json();
  await zetEvenement({ max_tickets: 500 - info.plaatsen_vrij + 3 });
  const antwoorden = await Promise.all(Array.from({ length: 8 }, () => bestelJson({ aantal: "1" }).then((r) => r.json())));
  assert.equal(antwoorden.filter((a) => a.checkoutUrl).length, 3);
  await zetEvenement({ max_tickets: 500 });
});

test("verkoop dicht of nog niet open", async () => {
  await zetEvenement({ verkoop_open_vanaf: new Date(Date.now() + 864e5).toISOString() });
  assert.equal((await (await bestelJson()).json()).fout, "verkoop_gesloten");
  assert.equal((await (await fetch(`${F}/ticketinfo?evenement=${SLUG}`)).json()).verkoop, "nog_niet_open");
  await zetEvenement({ verkoop_open_vanaf: new Date(Date.now() - 864e5).toISOString(), verkoop_dicht_op: new Date(Date.now() - 1000).toISOString() });
  assert.equal((await (await bestelJson()).json()).fout, "verkoop_gesloten");
  await zetEvenement({ verkoop_dicht_op: null });
});

test("Mollie onbereikbaar: nette fout en de plaatsen komen direct weer vrij", async () => {
  await fetch(`${NEP}/__storing`, { method: "POST", body: JSON.stringify({ aan: true }) });
  const r = await bestelJson({ aantal: "1" });
  await fetch(`${NEP}/__storing`, { method: "POST", body: JSON.stringify({ aan: false }) });
  assert.equal(r.status, 502);
  assert.equal((await r.json()).fout, "betaling_mislukt");
  const laatste = (await db("orders?select=status,mollie_payment_id&order=aangemaakt_op.desc&limit=1"))[0];
  assert.deepEqual(laatste, { status: "mislukt", mollie_payment_id: null });
});

test("maximaal 5 bestellingen per e-mailadres per uur", async () => {
  const email = `veel${Date.now()}@voorbeeld.nl`;
  for (let i = 0; i < 5; i++) assert.ok((await (await bestelJson({ email, aantal: "1" })).json()).checkoutUrl);
  const zesde = await bestelJson({ email: email.toUpperCase(), aantal: "1" });
  assert.equal(zesde.status, 429);
});

test("bezoekers (anon-sleutel) kunnen niets lezen of aanroepen", async () => {
  const h = { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" };
  for (const tabel of ["orders", "tickets", "events", "beheerders"]) {
    const r = await fetch(`${API}/rest/v1/${tabel}?select=*`, { headers: h });
    assert.ok(r.status === 401 || r.status === 403 || (r.ok && (await r.json()).length === 0), tabel);
  }
  const rpc = await fetch(`${API}/rest/v1/rpc/maak_bestelling`, { method: "POST", headers: h, body: "{}" });
  assert.ok(rpc.status >= 400);
});

test("CORS: alleen de eigen site mag vanuit de browser bestellen", async (t) => {
  const goed = await fetch(`${F}/create-order`, { method: "OPTIONS", headers: { Origin: "http://localhost:8080" } });
  // The local Supabase gateway (Kong) always adds "*"; online the function's own header is used.
  if (goed.headers.get("access-control-allow-origin") === "*") return t.skip("lokale gateway zet altijd *; online controleren");
  assert.equal(goed.headers.get("access-control-allow-origin"), "http://localhost:8080");
  const vreemd = await fetch(`${F}/create-order`, { method: "OPTIONS", headers: { Origin: "https://kwaadaardig.example" } });
  assert.equal(vreemd.headers.get("access-control-allow-origin"), null);
});
