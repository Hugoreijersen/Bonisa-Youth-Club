// Personal ticket page: reads the secret after the # and fetches the tickets.
(() => {
  const blok = document.getElementById("mijn-tickets");
  if (!blok) return;

  const toon = (naam) => blok.querySelectorAll("[data-toon]").forEach((el) => { el.hidden = el.dataset.toon !== naam; });
  const veld = (naam) => blok.querySelector(`[data-veld="${naam}"]`);
  const toegang = location.hash.slice(1);
  const tz = { timeZone: "Europe/Amsterdam" };
  const datum = (iso) => new Intl.DateTimeFormat("nl-NL", { ...tz, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
  const tijd = (iso) => new Intl.DateTimeFormat("nl-NL", { ...tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  blok.querySelector('[data-actie="print"]').addEventListener("click", () => window.print());

  (async () => {
    if (!/^[0-9a-f]{32}$/.test(toegang)) return toon("onbekend");
    try {
      const r = await fetch(`${blok.dataset.functies}/mijn-tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-region": "eu-central-1" },
        body: JSON.stringify({ toegang }),
      });
      if (r.status === 404) return toon("onbekend");
      const data = await r.json();
      if (data.status !== "betaald") return toon("ongeldig");

      veld("voornaam").textContent = data.voornaam;
      veld("evenement").textContent = data.evenement.naam;
      veld("wanneer").textContent = `D.V. ${datum(data.evenement.begint_op)}, aanvang ${tijd(data.evenement.begint_op)}`;
      veld("locatie").textContent = data.evenement.locatie;

      const lijst = veld("tickets");
      for (const t of data.tickets) {
        const li = document.createElement("li");
        li.className = "ticket";
        const img = document.createElement("img");
        img.src = t.qr;
        img.alt = `QR-code van ticket ${t.volgnummer}`;
        img.width = 232;
        img.height = 232;
        const kop = document.createElement("p");
        kop.className = "ticket__nummer";
        kop.textContent = `Ticket ${t.volgnummer} van ${data.aantal}`;
        const code = document.createElement("p");
        code.className = "ticket__code";
        code.textContent = t.code.toUpperCase();
        li.append(img, kop, code);
        if (t.gescand_op) {
          const s = document.createElement("p");
          s.className = "ticket__gescand";
          s.textContent = `Gescand om ${tijd(t.gescand_op)}`;
          li.append(s);
        }
        lijst.append(li);
      }
      toon("tickets");
    } catch {
      toon("onbekend");
    }
  })();
})();
