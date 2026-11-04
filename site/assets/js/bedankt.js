// Thank-you page: asks the ticket system for the status of the order and
// shows the matching block. Checks again for about a minute while the
// payment is still open.
(() => {
  const blok = document.getElementById("bedankt");
  if (!blok) return;

  const id = new URLSearchParams(location.search).get("bestelling") ?? "";
  const toon = (naam) => blok.querySelectorAll(".uitslag").forEach((u) => { u.hidden = u.dataset.toon !== naam; });
  const euro = (cent) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cent / 100);

  let pogingen = 0;
  const vraag = async () => {
    try {
      const r = await fetch(`${blok.dataset.functies}/ticketinfo?bestelling=${encodeURIComponent(id)}`, { headers: { "x-region": "eu-central-1" } });
      if (r.status === 404 || r.status === 400) return toon("onbekend");
      const s = await r.json();
      if (s.status === "betaald") {
        blok.querySelector('[data-veld="aantal"]').textContent = `${s.aantal} ${s.aantal === 1 ? "ticket" : "tickets"}`;
        blok.querySelector('[data-veld="bedrag"]').textContent = euro(s.bedrag_cent);
        return toon("betaald");
      }
      if (s.status === "open") {
        toon(pogingen === 0 ? "laden" : "open");
        if (pogingen++ < 20) setTimeout(vraag, 3000);
        return;
      }
      toon("mislukt");
    } catch {
      if (pogingen++ < 20) setTimeout(vraag, 3000); else toon("open");
    }
  };
  vraag();
})();
