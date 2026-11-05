// End-to-end tests for ordering and paying, against a local Supabase and the
// fake Mollie. How to run: docs/ticketsysteem.md ("Testen").
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { start as startNepDiensten } from "./nep-diensten.mjs";

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
before(async () => {
  nep = await startNepDiensten();
  // Clean slate for the test event, so places and figures are predictable.
  const [ev] = await db(`events?slug=eq.${SLUG}&select=id`);
  await db(`orders?event_id=eq.${ev.id}`, { method: "DELETE" });
  await db("events?slug=neq." + SLUG, { method: "DELETE" });
});
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

// --- Phase 3: ticket mail, ticket page, scanning, management ---------------
const mails = async () => (await fetch(`${NEP}/__mails`)).json();
const aanmeldingen = async () => (await fetch(`${NEP}/__aanmeldingen`)).json();
const mailsAan = async (email) => (await mails()).filter((m) => m.to[0].email === email);

async function betaaldeBestelling(extra = {}) {
  const g = gegevens(extra);
  const { bestelling } = await (await fetch(`${F}/create-order`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(g),
  })).json();
  const pid = await paymentVan(bestelling);
  await nepZet(pid, { status: "paid" });
  const w = await webhook(pid);
  return { id: bestelling, pid, email: g.email, webhook: w, order: await order(bestelling) };
}

const authHeaders = { apikey: ANON, "Content-Type": "application/json" };
async function maakAccount(rol) {
  const email = `${rol ?? "geen"}${Date.now()}${teller++}@voorbeeld.nl`;
  const wachtwoord = "testwachtwoord-123";
  const r = await fetch(`${API}/auth/v1/admin/users`, {
    method: "POST", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: wachtwoord, email_confirm: true }),
  });
  const user = await r.json();
  if (rol) await db("beheerders", { method: "POST", body: JSON.stringify({ user_id: user.id, rol }) });
  return { id: user.id, email, wachtwoord, token: await inloggen(email, wachtwoord) };
}
async function inloggen(email, wachtwoord) {
  const r = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: authHeaders, body: JSON.stringify({ email, password: wachtwoord }),
  });
  return (await r.json()).access_token;
}
const scan = (token, code, evenement = SLUG) => fetch(`${F}/scan`, {
  method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify({ evenement, code }),
});
const beheer = (token, actie, extra = {}) => fetch(`${F}/beheer`, {
  method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({ actie, ...extra }),
});

test("ticketmail: één mail met een QR-code per ticket en een link naar de ticketpagina", async () => {
  const b = await betaaldeBestelling({ aantal: "2", nieuwsbrief: "on" });
  assert.equal(b.webhook.status, 200);
  await webhook(b.pid); // Mollie calls again: no second mail
  const m = await mailsAan(b.email);
  assert.equal(m.length, 1);
  assert.match(m[0].subject, /Je tickets voor Katwijkse Jongerenzang 2027/);
  assert.deepEqual(m[0].attachments.map((a) => [a.id, a.disposition]), [["ticket1", "inline"], ["ticket2", "inline"]]);
  assert.ok(m[0].html.includes(`/tickets/mijn/#${b.order.toegang}`));
  assert.ok(m[0].html.includes("cid:ticket2"));
  assert.ok(m[0].text.includes("Ticket 2 van 2"));
  assert.ok((await order(b.id)).mail_verstuurd_op);
  // newsletter: once, only with the checkbox
  const a = (await aanmeldingen()).filter((x) => x.email === b.email);
  assert.equal(a.length, 1);
  assert.equal(a[0].fields.name, "Test");
  const zonder = await betaaldeBestelling({ nieuwsbrief: "" });
  assert.equal((await aanmeldingen()).filter((x) => x.email === zonder.email).length, 0);
});

test("ticketmail: als mailen mislukt, probeert Mollie het later opnieuw en komt de mail alsnog", async () => {
  await fetch(`${NEP}/__mailstoring`, { method: "POST", body: JSON.stringify({ aan: true }) });
  const b = await betaaldeBestelling();
  await fetch(`${NEP}/__mailstoring`, { method: "POST", body: JSON.stringify({ aan: false }) });
  assert.equal(b.webhook.status, 500);
  assert.equal(b.order.status, "betaald");
  assert.equal(b.order.mail_verstuurd_op, null);
  assert.equal((await webhook(b.pid)).status, 200);
  assert.equal((await mailsAan(b.email)).length, 1);
});

test("ticketpagina: alleen met de geheime sleutel uit de mail", async () => {
  const b = await betaaldeBestelling({ aantal: "2" });
  const post = (toegang) => fetch(`${F}/mijn-tickets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toegang }) });
  const r = await (await post(b.order.toegang)).json();
  assert.equal(r.status, "betaald");
  assert.equal(r.voornaam, "Test");
  assert.equal(r.tickets.length, 2);
  assert.match(r.tickets[0].qr, /^data:image\/gif;base64,/);
  assert.equal(r.achternaam, undefined);
  assert.equal(r.email, undefined);
  assert.equal((await post("0".repeat(32))).status, 404);
  assert.equal((await post("geen-sleutel")).status, 404);
});

test("scannen: alleen met login en rol; elk ticket maar één keer", async () => {
  const scanner = await maakAccount("scanner");
  const zonderRol = await maakAccount(null);
  const b = await betaaldeBestelling({ aantal: "2" });
  const [t1, t2] = await tickets(b.id);

  assert.equal((await scan(null, t1.code)).status, 401);
  assert.equal((await scan("onzin", t1.code)).status, 401);
  assert.equal((await scan(zonderRol.token, t1.code)).status, 403);

  const eerste = await (await scan(scanner.token, t1.code.toUpperCase())).json();
  assert.equal(eerste.resultaat, "geldig");
  assert.equal(eerste.aantal, 2);
  assert.equal(eerste.voornaam, "Test");
  const tweede = await (await scan(scanner.token, t1.code)).json();
  assert.equal(tweede.resultaat, "al_gescand");
  assert.ok(tweede.gescand_op);
  assert.equal((await (await scan(scanner.token, "f".repeat(32))).json()).resultaat, "onbekend");
  assert.equal((await (await scan(scanner.token, "geen code")).json()).resultaat, "onbekend");

  // two scanners at the same moment: only one lets the person in
  const tegelijk = await Promise.all([scan(scanner.token, t2.code), scan(scanner.token, t2.code)].map((p) => p.then((r) => r.json())));
  assert.deepEqual(tegelijk.map((x) => x.resultaat).sort(), ["al_gescand", "geldig"]);

  // refunded: no longer valid
  const c = await betaaldeBestelling({ aantal: "1" });
  await nepZet(c.pid, { amountRefunded: { currency: "EUR", value: "4.50" } }); await webhook(c.pid);
  const [tc] = await tickets(c.id);
  assert.equal((await (await scan(scanner.token, tc.code)).json()).resultaat, "ongeldig");

  // ticket for this event, scanned at another event
  await db("events", { method: "POST", body: JSON.stringify({ slug: "ander-evenement", naam: "Ander", begint_op: new Date().toISOString(), locatie: "X", prijs_cent: 0, max_tickets: 10 }) });
  const [t3] = await tickets((await betaaldeBestelling()).id);
  assert.equal((await (await scan(scanner.token, t3.code, "ander-evenement")).json()).resultaat, "ander_evenement");
  assert.equal((await (await scan(scanner.token, t3.code)).json()).resultaat, "geldig");
});

test("beheer: alleen kantoor; overzicht, bestellingen, export en mail opnieuw", async () => {
  const kantoor = await maakAccount("kantoor");
  const scanner = await maakAccount("scanner");
  assert.deepEqual(await (await beheer(scanner.token, "ik")).json(), { email: scanner.email, rol: "scanner" });
  assert.equal((await beheer(scanner.token, "overzicht", { evenement: SLUG })).status, 403);
  assert.equal((await beheer("onzin", "ik")).status, 401);

  const b = await betaaldeBestelling({ aantal: "3", nieuwsbrief: "on" });
  const o = await (await beheer(kantoor.token, "overzicht", { evenement: SLUG })).json();
  assert.ok(o.verkocht >= 3);
  assert.equal(o.evenement.slug, SLUG);
  assert.equal(o.opbrengst_cent % 450, 0);

  const lijst = await (await beheer(kantoor.token, "bestellingen", { evenement: SLUG })).json();
  const rij = lijst.find((x) => x.id === b.id);
  assert.equal(rij.email, b.email);
  assert.equal(rij.toegang, undefined);

  const exp = await (await beheer(kantoor.token, "export", { evenement: SLUG })).json();
  assert.ok(exp.orders.some((x) => x.id === b.id));
  assert.equal(exp.tickets.filter((t) => t.order_id === b.id).length, 3);

  assert.equal((await (await beheer(kantoor.token, "mail_opnieuw", { order_id: b.id })).json()).uitkomst, "verstuurd");
  assert.equal((await mailsAan(b.email)).length, 2);
  const open = await (await bestelJson({ aantal: "1" })).json();
  assert.equal((await beheer(kantoor.token, "mail_opnieuw", { order_id: open.bestelling })).status, 409);
});

test("beheer: evenement instellen en accounts voor scanners", async () => {
  const kantoor = await maakAccount("kantoor");
  const [ev] = await db(`events?slug=eq.${SLUG}&select=*`);
  const opslaan = (wijziging) => beheer(kantoor.token, "evenement_opslaan", { evenement: { ...ev, ...wijziging } });

  assert.equal((await (await opslaan({ max_tickets: 1 })).json()).fout, "minder_dan_verkocht");
  assert.equal((await (await opslaan({ prijs_cent: -1 })).json()).fout, "ongeldig_prijs_cent");
  const [nu] = await (await opslaan({ max_per_bestelling: 8 })).json();
  assert.equal(nu.max_per_bestelling, 8);
  await opslaan({ max_per_bestelling: 10 });
  const [nieuw] = await (await opslaan({ slug: "jongerenzang-2028", naam: "Katwijkse Jongerenzang 2028", verkoop_open_vanaf: "" })).json();
  assert.equal(nieuw.slug, "jongerenzang-2028");
  assert.equal(nieuw.verkoop_open_vanaf, null);
  assert.ok((await (await beheer(kantoor.token, "evenementen")).json()).some((e) => e.slug === "jongerenzang-2028"));

  const email = `deur${Date.now()}@voorbeeld.nl`;
  assert.equal((await (await beheer(kantoor.token, "beheerder_toevoegen", { email, wachtwoord: "kort", rol: "scanner" })).json()).fout, "wachtwoord_te_kort");
  const { user_id } = await (await beheer(kantoor.token, "beheerder_toevoegen", { email, wachtwoord: "lang-genoeg-wachtwoord", rol: "scanner" })).json();
  const token = await inloggen(email, "lang-genoeg-wachtwoord");
  assert.equal((await (await beheer(token, "ik")).json()).rol, "scanner");
  const lijst = await (await beheer(kantoor.token, "beheerders")).json();
  assert.ok(lijst.some((x) => x.email === email && x.rol === "scanner"));
  assert.equal((await (await beheer(kantoor.token, "beheerder_verwijderen", { user_id: kantoor.id })).json()).fout, "niet_jezelf");
  await beheer(kantoor.token, "beheerder_verwijderen", { user_id });
  assert.equal(await inloggen(email, "lang-genoeg-wachtwoord"), undefined);
});

test("beheer: uitgenodigd account krijgt een wachtwoord en daarna de rol kantoor", async () => {
  const kantoor = await maakAccount("kantoor");
  const email = `uitgenodigd${Date.now()}@voorbeeld.nl`;
  const adminH = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };

  // What the Supabase dashboard does: an invitation link (type=invite).
  const link = await (await fetch(`${API}/auth/v1/admin/generate_link`, {
    method: "POST", headers: adminH, body: JSON.stringify({ type: "invite", email }),
  })).json();
  let lijst = await (await beheer(kantoor.token, "beheerders")).json();
  assert.ok(lijst.some((x) => x.email === email && x.rol === null && x.uitnodiging_open));

  // Following the link gives a login in the fragment, as /welkom/ receives it.
  const r = await fetch(`${API}/auth/v1/verify?token=${link.hashed_token}&type=invite&redirect_to=http://localhost:8080/welkom/`,
    { redirect: "manual" });
  const fragment = new URLSearchParams(new URL(r.headers.get("location")).hash.slice(1));
  assert.equal(fragment.get("type"), "invite");
  const token = fragment.get("access_token");

  // /welkom/: choose a password.
  const gezet = await fetch(`${API}/auth/v1/user`, {
    method: "PUT", headers: { ...authHeaders, Authorization: `Bearer ${token}` },
    body: JSON.stringify({ password: "mijn-eigen-wachtwoord" }),
  });
  assert.equal(gezet.status, 200);
  const eigenToken = await inloggen(email, "mijn-eigen-wachtwoord");
  assert.ok(eigenToken);
  assert.equal((await (await beheer(eigenToken, "ik")).json()).rol, null);
  assert.equal((await beheer(eigenToken, "overzicht", { evenement: SLUG })).status, 403);

  // Office gives the account the role kantoor on /beheer/.
  lijst = await (await beheer(kantoor.token, "beheerders")).json();
  const nieuw = lijst.find((x) => x.email === email);
  assert.equal(nieuw.uitnodiging_open, false);
  assert.equal((await (await beheer(eigenToken, "rol_wijzigen", { user_id: nieuw.user_id, rol: "kantoor" })).json()).fout, "geen_toegang");
  assert.equal((await (await beheer(kantoor.token, "rol_wijzigen", { user_id: nieuw.user_id, rol: "baas" })).json()).fout, "ongeldige_rol");
  assert.equal((await (await beheer(kantoor.token, "rol_wijzigen", { user_id: kantoor.id, rol: "scanner" })).json()).fout, "niet_jezelf");
  assert.equal((await (await beheer(kantoor.token, "rol_wijzigen", { user_id: nieuw.user_id, rol: "kantoor" })).json()).rol, "kantoor");
  assert.equal((await (await beheer(eigenToken, "ik")).json()).rol, "kantoor");
  assert.equal((await beheer(eigenToken, "overzicht", { evenement: SLUG })).status, 200);

  // And back to no role: the account stays, the access goes.
  await beheer(kantoor.token, "rol_wijzigen", { user_id: nieuw.user_id, rol: "geen" });
  assert.equal((await (await beheer(eigenToken, "ik")).json()).rol, null);
  await beheer(kantoor.token, "beheerder_verwijderen", { user_id: nieuw.user_id });
});

test("nieuwe functies: bezoekers kunnen de nieuwe SQL-functies niet aanroepen", async () => {
  const h = { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" };
  for (const f of ["mijn_tickets", "scan_ticket", "beheer_overzicht", "ticketmail_claim", "rol_van"]) {
    const r = await fetch(`${API}/rest/v1/rpc/${f}`, { method: "POST", headers: h, body: "{}" });
    assert.ok(r.status >= 400, f);
  }
});
