// Login for the scan page and the management page (Supabase Auth).
// The login is kept in sessionStorage: closing the tab logs you out.
// Usage: Inloggen.start({ rollen: ["scanner", "kantoor"], tweestap: true, klaar: (ik) => {...} })
// tweestap: office must also enter the code of an authenticator app (TOTP,
// Supabase Auth MFA). The first time, the page shows a QR code to set it up.
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

  async function auth(pad, body, token, method = "POST") {
    const r = await fetch(`${instellingen.auth}/${pad}`, {
      method,
      headers: {
        apikey: instellingen.sleutel,
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(method === "GET" ? {} : { body: JSON.stringify(body ?? {}) }),
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
    if (instellingen.tweestapFormulier) instellingen.tweestapFormulier.hidden = true;
    instellingen.formulier.hidden = false;
    const m = instellingen.formulier.querySelector("[data-melding]");
    m.textContent = melding ?? "";
    m.hidden = !melding;
  }

  // --- Two-step login (office on the management page) -----------------------
  let factorId = null;

  async function toonTweestap(ik) {
    const t = await token();
    const f = instellingen.tweestapFormulier;
    const instellen = f.querySelector("[data-tweestap-instellen]");
    const m = f.querySelector("[data-melding]");
    m.hidden = true;
    factorId = null;
    if (ik.tweestap) {
      const { data } = await auth("user", null, t, "GET");
      factorId = (data?.factors ?? []).find((x) => x.factor_type === "totp" && x.status === "verified")?.id ?? null;
    }
    if (!factorId) {
      // First time: remove half-finished attempts, then set up a new app.
      const { data } = await auth("user", null, t, "GET");
      for (const x of data?.factors ?? []) {
        if (x.status !== "verified") await auth(`factors/${x.id}`, null, t, "DELETE");
      }
      const nieuw = await auth("factors", { factor_type: "totp" }, t);
      if (!nieuw.ok) return toonInlog("Tweestapsverificatie instellen lukt nu niet. Probeer het later opnieuw.");
      factorId = nieuw.data.id;
      // The Auth API gives the QR code as SVG text; show it as an image.
      const qr = nieuw.data.totp.qr_code;
      f.querySelector("[data-tweestap-qr]").src = qr.startsWith("data:") ? qr : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr)}`;
      f.querySelector("[data-tweestap-geheim]").textContent = nieuw.data.totp.secret;
    }
    instellen.hidden = ik.tweestap && Boolean(factorId);
    instellingen.formulier.hidden = true;
    instellingen.app.hidden = true;
    f.hidden = false;
    f.querySelector("input").focus();
  }

  async function controleerCode(e) {
    e.preventDefault();
    const f = instellingen.tweestapFormulier;
    const code = String(new FormData(f).get("code") ?? "").replace(/\s/g, "");
    const m = f.querySelector("[data-melding]");
    const knop = f.querySelector("button[type=submit]");
    const fout = (tekst) => { m.textContent = tekst; m.hidden = false; };
    if (!/^\d{6}$/.test(code)) return fout("Vul de 6 cijfers uit de app in.");
    knop.disabled = true;
    try {
      const t = await token();
      if (!t) return toonInlog("Je bent uitgelogd. Log opnieuw in.");
      const uitdaging = await auth(`factors/${factorId}/challenge`, {}, t);
      if (!uitdaging.ok) return fout("Er ging iets mis. Probeer het opnieuw.");
      const { ok, data } = await auth(`factors/${factorId}/verify`, { challenge_id: uitdaging.data.id, code }, t);
      if (!ok) return fout("Deze code klopt niet. Kijk of de tijd op je telefoon goed staat en probeer de volgende code.");
      bewaar(uitAntwoord(data));
      f.reset();
      await naInloggen();
    } catch {
      fout("Controleren lukt nu niet. Controleer je internetverbinding.");
    } finally {
      knop.disabled = false;
    }
  }

  async function naInloggen() {
    const { data } = await functie("beheer", { actie: "ik" });
    if (!instellingen.rollen.includes(data.rol)) {
      bewaar(null);
      return toonInlog("Dit account heeft geen toegang tot deze pagina.");
    }
    if (instellingen.tweestap && data.rol === "kantoor" && data.aal !== "aal2") return toonTweestap(data);
    if (instellingen.tweestapFormulier) instellingen.tweestapFormulier.hidden = true;
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
      tweestapFormulier: root.querySelector("[data-tweestap]"),
      app: root.querySelector("[data-app]"),
    };
    root.querySelectorAll("[data-uitloggen]").forEach((k) => k.addEventListener("click", uitloggen));
    instellingen.tweestapFormulier?.addEventListener("submit", controleerCode);

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
