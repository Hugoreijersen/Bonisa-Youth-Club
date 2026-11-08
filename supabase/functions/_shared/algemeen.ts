// Shared helpers for the edge functions. Explanation: docs/ticketsysteem.md
// No external packages: everything uses the standard fetch API.

// Secrets come from the Supabase project settings, never from the repository.
export function env(naam: string, verplicht = true): string {
  const waarde = Deno.env.get(naam) ?? "";
  if (verplicht && !waarde) throw new Error(`Missing environment variable ${naam}`);
  return waarde;
}

// --- Database: calls the SQL functions through the Supabase REST API with the
// service role key. That key only exists inside the functions.
async function rest(pad: string, init: RequestInit = {}) {
  const sleutel = env("SUPABASE_SERVICE_ROLE_KEY");
  const antwoord = await fetch(`${env("SUPABASE_URL")}/rest/v1/${pad}`, {
    ...init,
    headers: {
      apikey: sleutel,
      Authorization: `Bearer ${sleutel}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const tekst = await antwoord.text();
  const data = tekst ? JSON.parse(tekst) : null;
  return { ok: antwoord.ok, data };
}

export class DatabaseFout extends Error {}

// Calls a SQL function. Errors raised in SQL (e.g. 'verkoop_gesloten') come
// back as DatabaseFout with that code in the message.
export async function rpc<T>(functie: string, parameters: Record<string, unknown>): Promise<T> {
  const { ok, data } = await rest(`rpc/${functie}`, { method: "POST", body: JSON.stringify(parameters) });
  if (!ok) throw new DatabaseFout(String(data?.message ?? "database"));
  return data as T;
}

// Reads one order (only the columns that are asked for).
export async function leesBestelling(id: string, kolommen: string) {
  const { ok, data } = await rest(`orders?id=eq.${encodeURIComponent(id)}&select=${kolommen}`);
  if (!ok) throw new DatabaseFout(String(data?.message ?? "database"));
  return (data as Record<string, unknown>[])[0] ?? null;
}

// Direct table access for the management page (service role, bypasses RLS).
export async function tabel(pad: string, init: RequestInit = {}) {
  const { ok, data } = await rest(pad, init);
  if (!ok) throw new DatabaseFout(String(data?.message ?? "database"));
  return data;
}

// --- Logged-in users (scan page, management page) --------------------------
// Checks the login token with Supabase Auth and looks up the role in the
// table beheerders. Returns null when the token is missing or not valid.
// aal: "aal2" once the six-digit code of the authenticator app was entered in
// this session (two-step login, besluit 67). tweestap: an app is set up.
export type Gebruiker = {
  id: string;
  email: string;
  rol: "kantoor" | "scanner" | null;
  aal: "aal1" | "aal2";
  tweestap: boolean;
};

type Factor = { id: string; factor_type: string; status: string };
export const heeftTweestap = (factors: Factor[] | undefined) =>
  (factors ?? []).some((f) => f.factor_type === "totp" && f.status === "verified");

// Reads the "aal" claim. Only called after Supabase Auth accepted the token,
// so the signature has been checked there.
function aalVan(token: string): "aal1" | "aal2" {
  try {
    const deel = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(deel)).aal === "aal2" ? "aal2" : "aal1";
  } catch {
    return "aal1";
  }
}

export async function gebruikerVan(req: Request): Promise<Gebruiker | null> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const antwoord = await fetch(`${env("SUPABASE_URL")}/auth/v1/user`, {
    headers: { apikey: env("SUPABASE_SERVICE_ROLE_KEY"), Authorization: `Bearer ${token}` },
  });
  if (!antwoord.ok) return null;
  const user = await antwoord.json();
  if (!user?.id) return null;
  const rol = await rpc<string | null>("rol_van", { p_user_id: user.id });
  return {
    id: user.id,
    email: user.email ?? "",
    rol: (rol as Gebruiker["rol"]) ?? null,
    aal: aalVan(token),
    tweestap: heeftTweestap(user.factors),
  };
}

// Supabase Auth admin API (create and remove accounts for scanners and office).
export async function authAdmin(pad: string, init: RequestInit = {}) {
  const sleutel = env("SUPABASE_SERVICE_ROLE_KEY");
  const antwoord = await fetch(`${env("SUPABASE_URL")}/auth/v1/admin/${pad}`, {
    ...init,
    headers: { apikey: sleutel, Authorization: `Bearer ${sleutel}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const tekst = await antwoord.text();
  return { ok: antwoord.ok, status: antwoord.status, data: tekst ? JSON.parse(tekst) : null };
}

// Invitation by mail (Supabase Auth). The invitee chooses a password on
// /welkom/ (site/welkom.njk). Sending it again to someone who has not accepted
// yet works too. The mail is sent by Supabase Auth itself (docs/beveiliging.md).
export async function uitnodigen(email: string, naarAdres: string) {
  const sleutel = env("SUPABASE_SERVICE_ROLE_KEY");
  const antwoord = await fetch(
    `${env("SUPABASE_URL")}/auth/v1/invite?redirect_to=${encodeURIComponent(naarAdres)}`,
    {
      method: "POST",
      headers: { apikey: sleutel, Authorization: `Bearer ${sleutel}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    },
  );
  const tekst = await antwoord.text();
  return { ok: antwoord.ok, status: antwoord.status, data: tekst ? JSON.parse(tekst) : null };
}

// The site that called us (only our own websites), else SITE_URL.
export function siteVan(req: Request): string {
  const herkomst = req.headers.get("origin") ?? "";
  return toegestaneHerkomsten().includes(herkomst) ? herkomst : env("SITE_URL").replace(/\/$/, "");
}

// --- CORS: only our own websites may call the functions from a browser. ---
function toegestaneHerkomsten(): string[] {
  return env("SITE_ORIGINS", false).split(",").map((s) => s.trim()).filter(Boolean);
}

export function corsHeaders(req: Request): Record<string, string> {
  const herkomst = req.headers.get("origin") ?? "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, x-region",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
  if (toegestaneHerkomsten().includes(herkomst)) {
    headers["Access-Control-Allow-Origin"] = herkomst;
  }
  return headers;
}

export function json(req: Request, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function doorsturen(url: string): Response {
  return new Response(null, { status: 303, headers: { Location: url, "Cache-Control": "no-store" } });
}

// Logs never contain personal data (docs/beveiliging.md): only codes and ids.
export function log(gebeurtenis: string, gegevens: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ gebeurtenis, ...gegevens }));
}

// --- Mollie ---------------------------------------------------------------
// MOLLIE_API_URL can point to a fake Mollie during automated tests.
const mollieUrl = () => env("MOLLIE_API_URL", false) || "https://api.mollie.com/v2";

export type MollieBetaling = {
  id: string;
  status: string;
  amount: { value: string; currency: string };
  amountRefunded?: { value: string; currency: string };
  amountChargedBack?: { value: string; currency: string };
  metadata?: { order_id?: string; gift_id?: string } | null;
  customerId?: string;
  mandateId?: string;
  subscriptionId?: string;
  sequenceType?: string;
  _links?: { checkout?: { href: string } };
};

export class MollieFout extends Error {
  constructor(public status: number, bericht: string) { super(bericht); }
}

// One call to the Mollie API. The key decides which website profile is used:
// MOLLIE_API_KEY for tickets, MOLLIE_GIFTEN_API_KEY for gifts (besluit 39).
export async function mollieVerzoek<T = MollieBetaling>(
  pad: string, init: RequestInit = {}, sleutel = env("MOLLIE_API_KEY"),
): Promise<T> {
  const antwoord = await fetch(`${mollieUrl()}${pad}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${sleutel}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!antwoord.ok) {
    throw new MollieFout(antwoord.status, `Mollie ${init.method ?? "GET"} ${pad.split("?")[0]} gave ${antwoord.status}`);
  }
  const tekst = await antwoord.text();
  return (tekst ? JSON.parse(tekst) : null) as T;
}

const mollie = (pad: string, init: RequestInit = {}) => mollieVerzoek<MollieBetaling>(pad, init);

export function maakBetaling(gegevens: {
  bedragCent: number;
  omschrijving: string;
  orderId: string;
  redirectUrl: string;
  webhookUrl: string;
}): Promise<MollieBetaling> {
  return mollie("/payments", {
    method: "POST",
    headers: { "Idempotency-Key": gegevens.orderId },
    body: JSON.stringify({
      amount: { currency: "EUR", value: centNaarEuro(gegevens.bedragCent) },
      description: gegevens.omschrijving,
      redirectUrl: gegevens.redirectUrl,
      ...(gegevens.webhookUrl ? { webhookUrl: gegevens.webhookUrl } : {}),
      locale: "nl_NL",
      metadata: { order_id: gegevens.orderId },
    }),
  });
}

export function haalBetaling(id: string): Promise<MollieBetaling> {
  return mollie(`/payments/${encodeURIComponent(id)}`);
}

// 450 -> "4.50" (Mollie wants a string with exactly two decimals)
export function centNaarEuro(cent: number): string {
  return (cent / 100).toFixed(2);
}

// The amount Mollie reports, in cents. Only euros count: any other currency
// gives -1, which never matches an order or gift, so nothing is marked paid.
export function bedragInEuro(bedrag: { value: string; currency: string } | undefined): number {
  return bedrag?.currency === "EUR" ? euroNaarCent(bedrag.value) : -1;
}

// "4.50" -> 450, without floating point surprises
export function euroNaarCent(waarde: string | undefined): number {
  if (!waarde || !/^\d+\.\d{2}$/.test(waarde)) return 0;
  const [heel, deel] = waarde.split(".");
  return Number(heel) * 100 + Number(deel);
}
