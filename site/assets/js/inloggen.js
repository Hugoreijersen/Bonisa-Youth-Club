// Login for the scan page and the management page (Supabase Auth).
// The login is kept in sessionStorage: closing the tab logs you out.
// Usage: Inloggen.start({ rollen: ["scanner", "kantoor"], klaar: (ik) => {...} })
window.Inloggen = (() => {
  const SLEUTEL = "jz-sessie";
  let instellingen = null;

  const lees = () => {
    try { return JSON.parse(sessionStorage.getItem(SLEUTEL) ?? "null"); } catch { return null; }
  };
  const bewaar = (s) => {
    try { s ? sessionStorage.setItem(SLEUTEL, JSON.stringify(s)) : sessionStorage.removeItem(SLEUTEL); } catch { /* private mode */ }
  };
  const uitAntwoord = (d) => ({
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    verloopt: Date.now() + (d.expires_in ?? 3600) * 1000,
  });

  async function auth(pad, body, token) {
    const r = await fetch(`${instellingen.auth}/${pad}`, {
      method: "POST",
      headers: {
        apikey: instellingen.sleutel,
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body ?? {}),
    });
    const tekst = await r.text();
    return { ok: r.ok, data: tekst ? JSON.parse(tekst) : null };
  }

  // A valid access token, refreshed when it is about to expire.
  async function token() {
    const s = lees();
    if (!s) return null;
    if (Date.now() < s.verloopt - 60_000) return s.access_token;
    const { ok, data } = await auth("token?grant_type=refresh_token", { refresh_token: s.refresh_token });
    if (!ok) { bewaar(null); return null; }
    const nieuw = uitAntwoord(data);
    bewaar(nieuw);
    return nieuw.access_token;
  }

  // Calls an edge function as the logged-in user.
  async function functie(naam, body) {
    const t = await token();
    if (!t) { toonInlog("Je bent uitgelogd. Log opnieuw in."); throw new Error("niet_ingelogd"); }
    const r = await fetch(`${instellingen.functies}/${naam}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json", "x-region": "eu-central-1" },
      body: JSON.stringify(body ?? {}),
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) { bewaar(null); toonInlog("Je bent uitgelogd. Log opnieuw in."); throw new Error("niet_ingelogd"); }
    return { status: r.status, ok: r.ok, data };
  }

  function toonInlog(melding) {
    instellingen.app.hidden = true;
    instellingen.formulier.hidden = false;
    const m = instellingen.formulier.querySelector("[data-melding]");
    m.textContent = melding ?? "";
    m.hidden = !melding;
  }

  async function naInloggen() {
    const { data } = await functie("beheer", { actie: "ik" });
    if (!instellingen.rollen.includes(data.rol)) {
      bewaar(null);
      return toonInlog("Dit account heeft geen toegang tot deze pagina.");
    }
    instellingen.formulier.hidden = true;
    instellingen.app.hidden = false;
    instellingen.klaar(data);
  }

  async function uitloggen() {
    const t = lees()?.access_token;
    bewaar(null);
    if (t) await auth("logout", {}, t).catch(() => {});
    toonInlog("Je bent uitgelogd.");
  }

  function start(opties) {
    const root = document.querySelector("[data-inloggen]");
    instellingen = {
      ...opties,
      functies: root.dataset.functies,
      auth: root.dataset.auth,
      sleutel: root.dataset.sleutel,
      formulier: root.querySelector("[data-inlogformulier]"),
      app: root.querySelector("[data-app]"),
    };
    root.querySelectorAll("[data-uitloggen]").forEach((k) => k.addEventListener("click", uitloggen));

    instellingen.formulier.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(instellingen.formulier);
      const knop = instellingen.formulier.querySelector("button");
      knop.disabled = true;
      try {
        const { ok, data } = await auth("token?grant_type=password", { email: f.get("email"), password: f.get("wachtwoord") });
        if (!ok) return toonInlog("E-mailadres of wachtwoord klopt niet.");
        bewaar(uitAntwoord(data));
        instellingen.formulier.reset();
        await naInloggen();
      } catch {
        toonInlog("Inloggen lukt nu niet. Controleer je internetverbinding.");
      } finally {
        knop.disabled = false;
      }
    });

    if (lees()) naInloggen().catch(() => toonInlog()); else toonInlog();
  }

  return { start, functie, uitloggen };
})();
