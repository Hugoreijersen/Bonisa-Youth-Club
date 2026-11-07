// End-to-end tests for gifts (one-off and monthly), against a local Supabase
// and the fake Mollie. How to run: docs/giften.md ("Testen").
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

if (!SERVICE || !ANON) throw new Error("Local Supabase not running: npm run db:start");

let nep;
before(async () => { nep = await startNepDiensten(); });
after(() => nep?.close());

// --- helpers ---------------------------------------------------------------
const h = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const lees = async (pad) => (await fetch(`${API}/rest/v1/${pad}`, { headers: h })).json();
// A function that returns nothing (void) answers with an empty body.
const rpc = async (functie, parameters = {}) => {
  const tekst = await (await fetch(`${API}/rest/v1/rpc/${functie}`, { method: "POST", headers: h, body: JSON.stringify(parameters) })).text();
  return tekst ? JSON.parse(tekst) : null;
};
const gift = async (id) => (await lees(`giften?id=eq.${id}&select=*`))[0];
const giftenVan = (periodiekId) => lees(`giften?periodiek_id=eq.${periodiekId}&select=*`);
const periodiek = async (id) => (await lees(`periodieke_giften?id=eq.${id}&select=*`))[0];
const nepZet = (id, velden) => fetch(`${NEP}/__zet/${id}`, { method: "POST", body: JSON.stringify(velden) });
const webhook = (id) => fetch(`${F}/gift-webhook`, { method: "POST", body: new URLSearchParams({ id }) });
const verzoeken = async () => (await fetch(`${NEP}/__verzoeken`)).json();
const abonnementen = async () => (await fetch(`${NEP}/__abonnementen`)).json();
const mails = async () => (await fetch(`${NEP}/__mails`)).json();
const mailsAan = async (email) => (await mails()).filter((m) => m.to[0].email === email);
const maandBetaling = async (sub, extra = {}) =>
  (await fetch(`${NEP}/__abonnement/${sub}/betaling`, { method: "POST", body: JSON.stringify(extra) })).json();
const standen = async () => (await fetch(`${F}/giftinfo?projecten=1`)).json();

let teller = 0;
const gegevens = (extra = {}) => ({
  project: "waterput", frequentie: "eenmalig", bedrag: "25", bedrag_anders: "",
  voornaam: "Test", achternaam: "Gever", email: `gever${Date.now()}-${teller++}@voorbeeld.nl`,
  nieuwsbrief: "", website: "", ...extra,
});
const geefJson = (extra) => fetch(`${F}/create-gift`, {
  method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:8080" },
  body: JSON.stringify(gegevens(extra)),
});
const geefFormulier = (extra) => fetch(`${F}/create-gift`, {
  method: "POST", body: new URLSearchParams(gegevens(extra)), redirect: "manual",
});

// A gift that is paid at Mollie and reported by the webhook.
async function betaaldeGift(extra = {}) {
  const g = gegevens(extra);
  const antwoord = await (await fetch(`${F}/create-gift`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(g),
  })).json();
  const rij = await gift(antwoord.gift);
  await nepZet(rij.mollie_payment_id, { status: "paid" });
  const w = await webhook(rij.mollie_payment_id);
  return { id: antwoord.gift, pid: rij.mollie_payment_id, email: g.email, webhook: w, gift: await gift(antwoord.gift) };
}

// --- one-off gifts ---------------------------------------------------------
test("eenmalige gift: bedrag uit het formulier, project uit de lijst, betaald na de melding", async () => {
  const r = await geefJson({ bedrag: "25" });
  assert.equal(r.status, 200);
  const { checkoutUrl, gift: id } = await r.json();
  assert.match(checkoutUrl, /\/checkout\/tr_/);

  let rij = await gift(id);
  assert.equal(rij.status, "open");
  assert.equal(rij.soort, "eenmalig");
  assert.equal(rij.bedrag_cent, 2500);
  assert.equal(rij.project_slug, "waterput");
  assert.equal(rij.project_naam, "Waterput in het dorp");

  const betaling = (await verzoeken()).find((v) => v.body?.metadata?.gift_id === id);
  assert.equal(betaling.body.amount.value, "25.00");
  assert.equal(betaling.body.sequenceType, undefined);
  assert.match(betaling.body.redirectUrl, new RegExp(`/geven/bedankt/\\?gift=${id}$`));
  assert.equal(betaling.idempotency, id);
  assert.match(betaling.body.webhookUrl, /gift-webhook\?forceFunctionRegion=eu-central-1$/);

  await nepZet(rij.mollie_payment_id, { status: "paid" });
  assert.equal((await webhook(rij.mollie_payment_id)).status, 200);
  rij = await gift(id);
  assert.equal(rij.status, "betaald");
  assert.ok(rij.betaald_op);

  const [mail] = await mailsAan(rij.email);
  assert.equal(mail.subject, "Bedankt voor uw gift voor Waterput in het dorp");
  assert.equal(mail.from.email, "giften@bonisa.nl");
  assert.match(mail.html, /€ 25,00/);
  assert.doesNotMatch(mail.html, /stoppen/);

  // Mollie calls again: still one mail.
  await webhook(rij.mollie_payment_id);
  assert.equal((await mailsAan(rij.email)).length, 1);
});

test("eigen bedrag met komma; te lage, te hoge en onzinbedragen worden geweigerd", async () => {
  const { gift: id } = await (await geefJson({ bedrag: "anders", bedrag_anders: "12,50" })).json();
  assert.equal((await gift(id)).bedrag_cent, 1250);
  const { gift: id2 } = await (await geefJson({ bedrag: "anders", bedrag_anders: "€ 7.5" })).json();
  assert.equal((await gift(id2)).bedrag_cent, 750);

  for (const bedrag of ["0,50", "abc", "20000", "-5", "1,234", ""]) {
    const r = await geefJson({ bedrag: "anders", bedrag_anders: bedrag });
    assert.equal(r.status, 400, bedrag);
    assert.equal((await r.json()).fout, "ongeldig_bedrag", bedrag);
  }
});

test("onbekend of gesloten project: geen gift en geen betaling", async () => {
  const voor = (await verzoeken()).length;
  for (const project of ["afgerond", "bestaat-niet"]) {
    const r = await geefJson({ project });
    assert.equal(r.status, 404, project);
    assert.equal((await r.json()).fout, "onbekend_project");
  }
  assert.equal((await verzoeken()).length, voor);
});

test("werkt zonder JavaScript: doorsturen naar Mollie, of terug met een foutcode", async () => {
  const goed = await geefFormulier();
  assert.equal(goed.status, 303);
  assert.match(goed.headers.get("location"), /\/checkout\/tr_/);

  const fout = await geefFormulier({ bedrag: "anders", bedrag_anders: "0" });
  assert.equal(fout.status, 303);
  assert.equal(fout.headers.get("location"), "http://localhost:8080/geven/?fout=ongeldig_bedrag&project=waterput");
});

test("spamveld en ontbrekende gegevens worden geweigerd", async () => {
  assert.equal((await (await geefJson({ website: "http://spam" })).json()).fout, "ongeldige_gegevens");
  assert.equal((await (await geefJson({ email: "geen-adres" })).json()).fout, "ongeldige_gegevens");
  assert.equal((await (await geefJson({ voornaam: " " })).json()).fout, "ongeldige_gegevens");
  assert.equal((await (await geefJson({ frequentie: "wekelijks" })).json()).fout, "ongeldige_soort");
});

test("een melding met een ander bedrag dan de gift verandert niets", async () => {
  const { gift: id } = await (await geefJson({ bedrag: "10" })).json();
  const rij = await gift(id);
  await nepZet(rij.mollie_payment_id, { status: "paid", amount: { value: "1.00", currency: "EUR" } });
  assert.equal((await webhook(rij.mollie_payment_id)).status, 500);
  assert.equal((await gift(id)).status, "open");
});

test("mislukt, verlopen en terugbetaald", async () => {
  const { gift: a } = await (await geefJson()).json();
  await nepZet((await gift(a)).mollie_payment_id, { status: "failed" });
  await webhook((await gift(a)).mollie_payment_id);
  assert.equal((await gift(a)).status, "mislukt");

  const { gift: b } = await (await geefJson()).json();
  await nepZet((await gift(b)).mollie_payment_id, { status: "expired" });
  await webhook((await gift(b)).mollie_payment_id);
  assert.equal((await gift(b)).status, "verlopen");

  const betaald = await betaaldeGift();
  await nepZet(betaald.pid, { amountRefunded: { value: "25.00", currency: "EUR" } });
  await webhook(betaald.pid);
  assert.equal((await gift(betaald.id)).status, "terugbetaald");
});

test("Mollie onbereikbaar: nette fout; een maandelijkse gift start dan niet", async () => {
  await fetch(`${NEP}/__storing`, { method: "POST", body: JSON.stringify({ aan: true }) });
  const g = gegevens({ frequentie: "maandelijks" });
  const r = await fetch(`${F}/create-gift`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(g) });
  await fetch(`${NEP}/__storing`, { method: "POST", body: JSON.stringify({ aan: false }) });
  assert.equal(r.status, 502);
  assert.equal((await r.json()).fout, "betaling_mislukt");
  const [rij] = await lees(`giften?email=eq.${encodeURIComponent(g.email)}&select=*`);
  assert.equal(rij.status, "mislukt");
  assert.equal((await periodiek(rij.periodiek_id)).status, "mislukt");
});

test("de bedankpagina vraagt zelf de status na als de melding nog niet kwam", async () => {
  const { gift: id } = await (await geefJson()).json();
  await nepZet((await gift(id)).mollie_payment_id, { status: "paid" });
  const status = await (await fetch(`${F}/giftinfo?gift=${id}`)).json();
  assert.deepEqual(status, { status: "betaald", soort: "eenmalig", bedrag_cent: 2500, project_naam: "Waterput in het dorp", periodiek: null });
  // No personal data in the public answer.
  assert.doesNotMatch(JSON.stringify(status), /@|Gever/);
});

test("maximaal 5 giften per e-mailadres per uur", async () => {
  const email = `veel${Date.now()}@voorbeeld.nl`;
  for (let i = 0; i < 5; i++) assert.ok((await (await geefJson({ email })).json()).checkoutUrl);
  const zesde = await geefJson({ email: email.toUpperCase() });
  assert.equal(zesde.status, 429);
});

test("nieuwsbrief alleen met het vinkje, één keer", async () => {
  const zonder = await betaaldeGift();
  const met = await betaaldeGift({ nieuwsbrief: "on" });
  await webhook(met.pid);
  const lijst = await (await fetch(`${NEP}/__aanmeldingen`)).json();
  assert.equal(lijst.filter((a) => a.email === zonder.email).length, 0);
  assert.equal(lijst.filter((a) => a.email === met.email).length, 1);
});

// --- monthly gifts ---------------------------------------------------------
async function betaaldeMaandgift(extra = {}) {
  const r = await betaaldeGift({ frequentie: "maandelijks", bedrag: "10", ...extra });
  return { ...r, periodiek: await periodiek(r.gift.periodiek_id) };
}

test("maandelijkse gift: klant, eerste betaling met iDEAL, daarna een abonnement bij Mollie", async () => {
  const { id, pid, email, gift: eerste, periodiek: p } = await betaaldeMaandgift();
  assert.equal(eerste.soort, "eerste");
  assert.equal(eerste.status, "betaald");

  const alle = await verzoeken();
  const klant = alle.find((v) => v.pad === "/v2/customers" && v.body?.email === email);
  assert.ok(klant, "Mollie-klant aangemaakt");
  const betaling = alle.find((v) => v.body?.metadata?.gift_id === id);
  assert.equal(betaling.body.sequenceType, "first");
  assert.equal(betaling.body.customerId, p.mollie_customer_id);

  assert.equal(p.status, "actief");
  assert.match(p.mollie_mandate_id, /^mdt_/);
  const sub = (await abonnementen()).find((s) => s.id === p.mollie_subscription_id);
  assert.equal(sub.amount.value, "10.00");
  assert.equal(sub.interval, "1 month");
  assert.equal(sub.mandateId, p.mollie_mandate_id);
  assert.equal(sub.metadata.periodiek_id, p.id);
  // Starts a month after the first payment, which already paid this month.
  const vandaag = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(new Date());
  assert.ok(sub.startDate > vandaag && sub.startDate.slice(0, 7) !== vandaag.slice(0, 7), sub.startDate);

  const [mail] = await mailsAan(email);
  assert.equal(mail.subject, "Bedankt voor uw maandelijkse gift voor Waterput in het dorp");
  assert.ok(mail.html.includes(`/geven/stoppen/#${p.stopcode}`));

  // Mollie calls again: no second subscription, no second mail.
  const aantal = (await abonnementen()).length;
  await webhook(pid);
  assert.equal((await abonnementen()).length, aantal);
  assert.equal((await mailsAan(email)).length, 1);
});

test("maandelijkse afschrijving: nieuwe gift, geen mail; dubbele melding telt één keer", async () => {
  const { email, periodiek: p } = await betaaldeMaandgift();
  const b = await maandBetaling(p.mollie_subscription_id);
  assert.equal((await webhook(b.id)).status, 200);
  assert.equal((await webhook(b.id)).status, 200);

  const rijen = await giftenVan(p.id);
  assert.equal(rijen.length, 2);
  const maand = rijen.find((r) => r.soort === "maandelijks");
  assert.equal(maand.status, "betaald");
  assert.equal(maand.bedrag_cent, 1000);
  assert.equal(maand.mollie_payment_id, b.id);
  assert.equal((await mailsAan(email)).length, 1, "alleen de mail bij de start");
});

test("maandelijkse afschrijving met een ander bedrag of onbekend abonnement wordt niet geteld", async () => {
  const { periodiek: p } = await betaaldeMaandgift();
  const verkeerd = await maandBetaling(p.mollie_subscription_id, { amount: { value: "99.00", currency: "EUR" } });
  assert.equal((await webhook(verkeerd.id)).status, 500);
  assert.equal((await giftenVan(p.id)).length, 1);
});

test("storno van een incasso: gift telt niet meer mee", async () => {
  const { periodiek: p } = await betaaldeMaandgift();
  const b = await maandBetaling(p.mollie_subscription_id);
  await webhook(b.id);
  await nepZet(b.id, { amountChargedBack: { value: "10.00", currency: "EUR" } });
  await webhook(b.id);
  const maand = (await giftenVan(p.id)).find((r) => r.soort === "maandelijks");
  assert.equal(maand.status, "terugbetaald");
});

test("eerste betaling mislukt: geen abonnement en niets om te stoppen", async () => {
  const { gift: id } = await (await geefJson({ frequentie: "maandelijks", bedrag: "10" })).json();
  const rij = await gift(id);
  await nepZet(rij.mollie_payment_id, { status: "canceled" });
  await webhook(rij.mollie_payment_id);
  const p = await periodiek(rij.periodiek_id);
  assert.equal(p.status, "mislukt");
  assert.equal(p.mollie_subscription_id, null);
  const stop = await (await fetch(`${F}/gift-stoppen`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: p.stopcode }),
  })).json();
  assert.equal(stop.uitkomst, "niet_actief");
});

test("de bedankpagina start de maandelijkse gift ook als de melding nog niet kwam", async () => {
  const { gift: id } = await (await geefJson({ frequentie: "maandelijks", bedrag: "15" })).json();
  await nepZet((await gift(id)).mollie_payment_id, { status: "paid" });
  const status = await (await fetch(`${F}/giftinfo?gift=${id}`)).json();
  assert.equal(status.status, "betaald");
  assert.equal(status.periodiek, "actief");
});

test("stoppen met de link uit de mail: abonnement bij Mollie opgezegd; nog eens kan geen kwaad", async () => {
  const { periodiek: p } = await betaaldeMaandgift();
  const info = await (await fetch(`${F}/giftinfo?stopcode=${p.stopcode}`)).json();
  assert.equal(info.status, "actief");
  assert.equal(info.bedrag_cent, 1000);
  assert.doesNotMatch(JSON.stringify(info), /@|Gever/);

  const stop = (code) => fetch(`${F}/gift-stoppen`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }),
  });
  assert.equal((await (await stop(p.stopcode)).json()).uitkomst, "gestopt");
  assert.equal((await abonnementen()).find((s) => s.id === p.mollie_subscription_id).status, "canceled");
  const na = await periodiek(p.id);
  assert.equal(na.status, "gestopt");
  assert.equal(na.gestopt_door, "gever");
  assert.equal((await (await stop(p.stopcode)).json()).uitkomst, "al_gestopt");

  assert.equal((await stop("0".repeat(32))).status, 404);
  assert.equal((await stop("geen-code")).status, 404);
});

test("gestopt vóór de eerste betaling klaar was: er start geen abonnement", async () => {
  const { gift: id } = await (await geefJson({ frequentie: "maandelijks", bedrag: "10" })).json();
  const rij = await gift(id);
  await rpc("periodiek_gestopt", { p_periodiek_id: rij.periodiek_id, p_door: "kantoor" });
  await nepZet(rij.mollie_payment_id, { status: "paid" });
  assert.equal((await webhook(rij.mollie_payment_id)).status, 200);
  const p = await periodiek(rij.periodiek_id);
  assert.equal(p.status, "gestopt");
  assert.equal(p.mollie_subscription_id, null);
  assert.equal((await mailsAan(rij.email)).length, 0, "geen mail 'gestart'");
});

// --- totals, office, security ------------------------------------------------
test("voortgang per project: alleen betaalde giften tellen", async () => {
  const voor = (await standen())["waar-het-nodig-is"] ?? { opgehaald_cent: 0, giften: 0, maandelijkse_gevers: 0 };
  await betaaldeGift({ project: "waar-het-nodig-is", bedrag: "40" });
  await betaaldeMaandgift({ project: "waar-het-nodig-is" });
  await geefJson({ project: "waar-het-nodig-is", bedrag: "500" }); // not paid
  const na = (await standen())["waar-het-nodig-is"];
  assert.equal(na.opgehaald_cent - voor.opgehaald_cent, 5000);
  assert.equal(na.giften - voor.giften, 2);
  assert.equal(na.maandelijkse_gevers - voor.maandelijkse_gevers, 1);
});

test("export voor de administratie: per periode, met project en soort", async () => {
  const { id } = await betaaldeGift({ bedrag: "anders", bedrag_anders: "33,30" });
  const vandaag = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(new Date());
  const rijen = await rpc("giften_export", { p_van: vandaag, p_tot: vandaag });
  const rij = rijen.find((r) => r.gift_id === id);
  assert.equal(rij.bedrag, "33.30");
  assert.equal(rij.project, "Waterput in het dorp");
  assert.equal(rij.soort, "eenmalig");
  assert.equal(rij.status, "betaald");
  assert.deepEqual(await rpc("giften_export", { p_van: "2000-01-01", p_tot: "2000-01-31" }), []);
});

test("bezoekers (anon-sleutel) kunnen geen giften lezen of functies aanroepen", async () => {
  const a = { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" };
  for (const tabel of ["giften", "periodieke_giften"]) {
    const r = await fetch(`${API}/rest/v1/${tabel}?select=*`, { headers: a });
    assert.ok(r.status === 401 || r.status === 403 || (r.ok && (await r.json()).length === 0), tabel);
  }
  for (const functie of ["maak_gift", "projectstanden", "giften_export", "periodiek_voor_stoppen"]) {
    const r = await fetch(`${API}/rest/v1/rpc/${functie}`, { method: "POST", headers: a, body: "{}" });
    assert.ok(r.status >= 400, functie);
  }
});
