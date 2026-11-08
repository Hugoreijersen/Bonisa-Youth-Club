// Landing page for the links that Supabase Auth mails (invitation or forgotten
// password). Supabase puts the login in the URL fragment:
//   /welkom/#access_token=...&refresh_token=...&expires_in=3600&type=invite
// or, when the link is expired or already used:
//   /welkom/#error=access_denied&error_code=otp_expired&error_description=...
// The invitee chooses a password; after that the account exists. Office gives
// it a role on /beheer/ (or already did when inviting).
(() => {
  const root = document.querySelector("[data-welkom]");
  if (!root) return;
  const $ = (sel) => root.querySelector(sel);
  const formulier = $("[data-wachtwoordformulier]");

  // Read the fragment once and remove it from the address bar right away, so
  // the token does not end up in the history or in a shared screenshot.
  const p = new URLSearchParams(location.hash.slice(1));
  if (location.hash) history.replaceState(null, "", location.pathname);

  function uitkomst(kop, tekst, link) {
    formulier.hidden = true;
    $("[data-uitkomst]").hidden = false;
    $("[data-uitkomst-kop]").textContent = kop;
    $("[data-uitkomst-tekst]").textContent = tekst;
    const a = $("[data-uitkomst-link]");
    a.hidden = !link;
    if (link) { a.href = link.href; a.textContent = link.tekst; }
  }
  function fout(tekst) {
    const m = $("[data-melding]");
    m.textContent = tekst;
    m.hidden = !tekst;
  }

  const token = p.get("access_token");
  if (!token) {
    const verlopen = p.get("error_code") === "otp_expired" || p.get("error");
    uitkomst(
      verlopen ? "Deze link werkt niet meer" : "Geen geldige link",
      verlopen
        ? "De link is verlopen of al gebruikt. Vraag kantoor om een nieuwe uitnodiging."
        : "Open deze pagina via de link in de uitnodiging die je per mail hebt gekregen.",
    );
    return;
  }

  const herstel = p.get("type") === "recovery";
  if (herstel) {
    $("[data-kop]").textContent = "Nieuw wachtwoord";
    $("[data-uitleg]").firstChild.textContent = "Kies een nieuw wachtwoord voor je account";
  }

  const auth = (pad, init) => fetch(`${root.dataset.auth}/${pad}`, {
    ...init,
    headers: { apikey: root.dataset.sleutel, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });

  // Show which account this is about.
  auth("user", { method: "GET" }).then((r) => r.ok ? r.json() : null).then((u) => {
    if (u?.email) $("[data-email]").textContent = ` (${u.email})`;
  }).catch(() => {});
  formulier.hidden = false;

  formulier.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = formulier.elements;
    const w = f.wachtwoord.value;
    if (w.length < 10 || !/[a-z]/i.test(w) || !/\d/.test(w)) return fout("Kies een wachtwoord van minstens 10 tekens, met letters én cijfers.");
    if (f.wachtwoord.value !== f.herhaal.value) return fout("De twee wachtwoorden zijn niet hetzelfde.");
    fout("");
    const knop = formulier.querySelector("button");
    knop.disabled = true;
    try {
      const r = await auth("user", { method: "PUT", body: JSON.stringify({ password: f.wachtwoord.value }) });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        if (r.status === 401 || r.status === 403) {
          return uitkomst("Deze link werkt niet meer", "De link is verlopen. Vraag kantoor om een nieuwe uitnodiging.");
        }
        return fout(d.error_code === "same_password"
          ? "Kies een ander wachtwoord dan je vorige."
          : d.error_code === "weak_password"
            ? "Dit wachtwoord is te zwak. Kies een langer wachtwoord."
            : "Opslaan lukt niet. Probeer het opnieuw.");
      }

      // Which role does this account have? Then we know where to send them.
      // Keep the login (same place as inloggen.js), so they are logged in there.
      let rol = null;
      try {
        sessionStorage.setItem("jz-sessie", JSON.stringify({
          access_token: token,
          refresh_token: p.get("refresh_token"),
          verloopt: Date.now() + Number(p.get("expires_in") ?? 3600) * 1000,
        }));
      } catch { /* private mode: they log in themselves */ }
      try {
        const ik = await fetch(`${root.dataset.functies}/beheer`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "x-region": "eu-central-1" },
          body: JSON.stringify({ actie: "ik" }),
        });
        rol = ik.ok ? (await ik.json()).rol : null;
      } catch { /* no role known: show the general message */ }

      const kop = herstel ? "Je wachtwoord is opgeslagen" : "Je account is klaar";
      if (rol === "kantoor") uitkomst(kop, "Je kunt nu de beheerpagina gebruiken.", { href: "/beheer/", tekst: "Naar de beheerpagina" });
      else if (rol === "scanner") uitkomst(kop, "Je kunt nu tickets scannen.", { href: "/scan/", tekst: "Naar de scanpagina" });
      else uitkomst(kop, "Kantoor geeft je account nog toegang. Daarna kun je inloggen met je e-mailadres en dit wachtwoord.");
    } catch {
      fout("Opslaan lukt nu niet. Controleer je internetverbinding.");
    } finally {
      knop.disabled = false;
    }
  });
})();
